import { inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LayerBoxes } from "@/plugin/adapters/figma/layer-boxes.ts";
import { InstanceProperties } from "@/plugin/adapters/figma/layer-meta/instance-properties.ts";
import { LAYER_READER } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { INSPECT_LAYOUT } from "@/plugin/operations/inspect/inspect.constants.ts";
import { InspectSubtree } from "@/plugin/operations/inspect/inspect-subtree.ts";
import { INSPECT, INSPECT_PARENT_LAYOUT_KEYS } from "@/shared/ops/inspect/inspect.constants.ts";
import type { InspectedLayer, InspectInput, InspectRaw } from "@/shared/ops/inspect/inspect.schema.ts";

type Box = InspectedLayer["box"];

/**
 * Layers as Figma has them, for inspect and measure (T-080, T-081): each layer's read-model entry read on its own (the
 * read op's field readers, one source), with its parent, its layout and painted boxes and its parent's room, all from
 * `relativeTo`'s top left (the page's without it), an instance's property defaults, and the styles and variables its
 * paints use. It only reads, so it
 * works while Allow edits is off (B-043); an id that is no layer is missing.
 */
@injectable()
export class InspectOperation extends Operation<InspectInput, InspectRaw> {
  readonly #boxes = new LayerBoxes();
  readonly #properties = new InstanceProperties();
  readonly #subtree = new InspectSubtree();
  readonly #parents = new Map<string, InspectedLayer["parentLayout"]>();

  readonly #lookup;
  readonly #reader;
  readonly #format;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    reader = inject(LAYER_READER),
    format = inject(NUMBER_FORMAT),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#reader = reader;
    this.#format = format;
  }

  protected async execute({ nodes = [], within, depth, fields, relativeTo }: InspectInput): Promise<InspectRaw> {
    const origin = relativeTo === undefined ? null : await this.#lookup.existing(relativeTo);
    const corner = this.#corner(origin);
    const read: { entry: InspectedLayer; node: SceneNode }[] = [];
    const missing: string[] = [];

    this.#reader.start();
    this.#parents.clear();

    const picked =
      within === undefined ? { ids: nodes, left: [], cut: false } : await this.#picked(within, depth, fields);

    for (const id of picked.ids) {
      // Figma throws for a lookup it cannot answer (offline, an instance's hidden layer gone): that id is missing (FX-015).
      const node = await this.#lookup.node(id).catch(() => null);

      if (node !== null && this.#isLayer(node)) {
        read.push({ entry: await this.#layer(node, corner), node });
      } else {
        missing.push(id);
      }
    }

    return {
      origin: origin === null ? null : { id: origin.id, name: origin.name },
      layers: read.map(({ entry }) => entry),
      missing,
      ...(picked.left.length === 0 && !picked.cut
        ? {}
        : { more: true as const, leftIds: picked.left.slice(0, INSPECT.maxLeftIds) }),
      ...(await this.#reader.shared(read)),
    };
  }

  /** A subtree's layers: the first 100 to read, the ids of the rest; the root alone (missing) when it is no layer. */
  async #picked(
    within: string,
    depth: number | undefined,
    fields: InspectInput["fields"],
  ): Promise<{ ids: string[]; left: string[]; cut: boolean }> {
    const root = await this.#lookup.node(within).catch(() => null);

    if (root === null || !this.#isLayer(root)) {
      return { ids: [within], left: [], cut: false };
    }

    const { nodes, cut } = this.#subtree.select(root, depth, fields);
    const ids = nodes.map(({ id }) => id);

    return { ids: ids.slice(0, INSPECT.maxLayers), left: ids.slice(INSPECT.maxLayers), cut };
  }

  /** The layout fields of a parent whose auto layout or grid places the layer, read once per parent. */
  async #parentLayout(parent: SceneNode | null, corner: Vector): Promise<Pick<InspectedLayer, "parentLayout">> {
    if (parent === null || !("layoutMode" in parent) || parent.layoutMode === INSPECT_LAYOUT.none) {
      return {};
    }

    if (!this.#parents.has(parent.id)) {
      const entry = await this.#reader.at(parent, corner);
      const layout: NonNullable<InspectedLayer["parentLayout"]> = { childCount: entry.childCount };

      for (const key of INSPECT_PARENT_LAYOUT_KEYS) {
        if (entry[key] !== undefined) {
          Object.assign(layout, { [key]: entry[key] });
        }
      }

      this.#parents.set(parent.id, layout);
    }

    const layout = this.#parents.get(parent.id);

    return layout === undefined ? {} : { parentLayout: layout };
  }

  /** The layer's ancestors below its page, outermost first. */
  #path(node: SceneNode): NonNullable<InspectedLayer["path"]> {
    const path: NonNullable<InspectedLayer["path"]> = [];

    for (let current = node.parent; current !== null && this.#isLayer(current); current = current.parent) {
      path.unshift({ id: current.id, name: current.name, type: current.type });
    }

    return path;
  }

  async #layer(node: SceneNode, corner: Vector): Promise<InspectedLayer> {
    const entry = await this.#reader.at(node, corner);
    const { parent } = node;
    const parentLayer = parent !== null && this.#isLayer(parent) ? parent : null;

    return {
      ...entry,
      parent: parent === null ? null : { id: parent.id, name: parent.name, type: parent.type },
      box: this.#box(this.#boxes.layout(node), corner) ?? {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
      },
      paintedBox: this.#box(this.#boxes.painted(node), corner),
      parentBox: parentLayer === null ? null : this.#box(this.#boxes.layout(parentLayer), corner),
      parentPadding: this.#padding(parentLayer),
      path: this.#path(node),
      ...(await this.#parentLayout(parentLayer, corner)),
      ...(node.type === FIGMA_NODE_TYPE.instance ? await this.#defaults(node) : {}),
    };
  }

  /** An instance's component's default of each property; none when its component is gone. */
  async #defaults(node: InstanceNode): Promise<Pick<InspectedLayer, "defaults">> {
    const main = await node.getMainComponentAsync();

    return main === null ? {} : { defaults: this.#properties.defaults(main) };
  }

  /** Where the boxes start: relativeTo's top left; the page's for a page, or without relativeTo. */
  #corner(origin: BaseNode | null): Vector {
    const box = origin === null ? null : this.#boxes.layout(origin);

    return { x: box?.x ?? 0, y: box?.y ?? 0 };
  }

  #isLayer(node: BaseNode): node is SceneNode {
    return node.type !== FIGMA_NODE_TYPE.document && node.type !== FIGMA_NODE_TYPE.page;
  }

  /** The padding of a parent whose auto layout places the layer; null for any other parent. */
  #padding(parent: SceneNode | null): InspectedLayer["parentPadding"] {
    return parent !== null && "layoutMode" in parent && parent.layoutMode !== INSPECT_LAYOUT.none
      ? { top: parent.paddingTop, right: parent.paddingRight, bottom: parent.paddingBottom, left: parent.paddingLeft }
      : null;
  }

  #box(rect: Rect | null, corner: Vector): Box | null {
    return rect === null
      ? null
      : {
        x: this.#round(rect.x - corner.x),
        y: this.#round(rect.y - corner.y),
        width: this.#round(rect.width),
        height: this.#round(rect.height),
      };
  }

  #round(value: number): number {
    return this.#format.round(value, PRECISION.layer);
  }
}
