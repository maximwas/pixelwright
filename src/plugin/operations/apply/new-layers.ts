import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PLACEMENT_SPAN } from "@/core/kernel/geometry/placement-span.ts";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_PLACE, APPLY_TEXT, NEW_LAYER_VALUE } from "@/plugin/operations/apply/apply.constants.ts";
import type { Place } from "@/plugin/operations/apply/apply.types.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import { INTENT_LAYOUT_MODE, INTENT_SELF_ALIGN } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Axis = typeof INTENT_LAYOUT_MODE.HORIZONTAL | typeof INTENT_LAYOUT_MODE.VERTICAL;

/**
 * New layers (T-123): made, put in their parent at once (taken away again when Figma refuses them there) and started
 * bare, with what the XML says and nothing more: no fill without a background, no clipping without overflow; once
 * written, a new auto layout frame hugs what the XML did not size and a layer on the page goes beside the others.
 */
@injectable()
export class NewLayers {
  readonly #factory;
  readonly #assign;
  readonly #capabilities;
  readonly #span;

  constructor(
    factory = inject(LAYER_FACTORY),
    assign = inject(ASSIGN),
    capabilities = inject(CAPABILITIES),
    span = inject(PLACEMENT_SPAN),
  ) {
    this.#factory = factory;
    this.#assign = assign;
    this.#capabilities = capabilities;
    this.#span = span;
  }

  create(
    type: NodeType,
    change: ApplyChangeData,
    { parent, index }: Place,
  ): SceneNode {
    const node = this.#made(type, change, parent);

    try {
      parent.insertChild(index, node);
      this.#bare(node, change.props);
    } catch (error) {
      this.discard(node);

      throw error;
    }

    return node;
  }

  /** A clone of the source with all it has, XML or not (T-126), at its place; taken away when Figma refuses it there. */
  copy(source: SceneNode, { parent, index }: Place): SceneNode {
    const node = source.clone();

    try {
      parent.insertChild(index, node);
    } catch (error) {
      this.discard(node);

      throw error;
    }

    return node;
  }

  /** After its write: a new auto layout frame hugs the axes the XML did not size; on the page it goes beside the rest. */
  finish(node: SceneNode, props: FigmaProps): void {
    try {
      this.#hug(node, props);
      this.#placeOnPage(node, props);
    } catch (error) {
      this.discard(node);

      throw error;
    }
  }

  /** A new set: the Components its frame holds combined in its place, the frame gone. */
  combine(holder: SceneNode): ComponentSetNode {
    const frame = holder as FrameNode;
    const components = frame.children.filter(
      (child): child is ComponentNode => child.type === FIGMA_NODE_TYPE.component,
    );
    const parent = frame.parent;

    if (components.length === 0 || parent === null) {
      frame.remove();

      throw new WriteError(APPLY_TEXT.emptySet);
    }

    const set = this.#factory.combine(components, parent, parent.children.indexOf(frame));

    frame.remove();
    this.#assign.set(set as ComponentSetNode, { fills: [], strokes: [] });

    return set;
  }

  /** A layer that failed after it existed goes, so a failed element leaves nothing in the user's file. */
  discard(node: SceneNode): void {
    if (!node.removed) {
      node.remove();
    }
  }

  /** The layer of the type: a slot in its component, an Icon drawn from its SVG (T-131), a TextPath along its path, else a bare one. */
  #made(
    type: NodeType,
    change: ApplyChangeData,
    parent: Place["parent"],
  ): SceneNode {
    const svg = change.props.asset?.svg;

    if (type === FIGMA_NODE_TYPE.slot) {
      return (parent as ComponentNode).createSlot();
    }

    if (type === FIGMA_NODE_TYPE.textPath) {
      // The planner sends a new TextPath only with its path (C-179).
      return this.#factory.textPath(change.props.path ?? "", change.props.pathStart);
    }

    return svg === undefined ? this.#factory.make(type, APPLY_TEXT.cannotMake(change.tag)) : this.#factory.icon(svg);
  }

  #bare(node: SceneNode, props: FigmaProps): void {
    const shape = node as FrameNode;

    if (
      props.fills === undefined &&
      !this.#capabilities.has(node, CAPABILITY.text) &&
      this.#capabilities.has(node, CAPABILITY.fills)
    ) {
      this.#assign.set(shape, { fills: [] });
    }

    if (props.strokes === undefined && node.type === FIGMA_NODE_TYPE.line) {
      this.#assign.set(shape, { strokes: [] });
    }

    if (props.clipsContent === undefined && node.type === FIGMA_NODE_TYPE.frame) {
      this.#assign.set(shape, { clipsContent: false });
    }

    if (node.type === FIGMA_NODE_TYPE.text) {
      this.#assign.set(node, { textAutoResize: NEW_LAYER_VALUE.fit });
    }
  }

  #hug(node: SceneNode, props: FigmaProps): void {
    const frame = node as FrameNode;

    if (!this.#capabilities.has(node, CAPABILITY.autoLayout) || frame.layoutMode === NEW_LAYER_VALUE.none) {
      return;
    }

    // A page or a section has no layoutMode: undefined, so nothing lays the layer out.
    const direction: unknown = (node.parent as FrameNode | null)?.layoutMode;

    this.#assign.set(frame, {
      layoutSizingHorizontal:
        props.width === undefined && !this.#fills(props, direction, INTENT_LAYOUT_MODE.HORIZONTAL)
          ? NEW_LAYER_VALUE.hug
          : undefined,
      layoutSizingVertical:
        props.height === undefined && !this.#fills(props, direction, INTENT_LAYOUT_MODE.VERTICAL)
          ? NEW_LAYER_VALUE.hug
          : undefined,
    });
  }

  /** Whether the layer fills the axis: flex along its parent, stretched across it or in a grid cell, or pinned to both edges. */
  #fills(
    props: FigmaProps,
    direction: unknown,
    axis: Axis,
  ): boolean {
    const horizontal = axis === INTENT_LAYOUT_MODE.HORIZONTAL;
    const across = horizontal ? INTENT_LAYOUT_MODE.VERTICAL : INTENT_LAYOUT_MODE.HORIZONTAL;
    const stretched =
      direction === INTENT_LAYOUT_MODE.GRID
        ? (horizontal ? props.justifySelf : props.alignSelf) === INTENT_SELF_ALIGN.STRETCH
        : props.alignSelf === INTENT_SELF_ALIGN.STRETCH && direction === across;
    const placed = horizontal ? props.horizontal : props.vertical;

    return ((props.grow ?? false) && direction === axis) || stretched || this.#span.sizes(placed);
  }

  #placeOnPage(node: SceneNode, props: FigmaProps): void {
    const parent = node.parent;

    if (parent?.type !== FIGMA_NODE_TYPE.page || props.horizontal !== undefined) {
      return;
    }

    const others = parent.children.filter((child) => child.id !== node.id);
    const right = Math.max(...others.map((child) => child.x + child.width), -APPLY_PLACE.pageGap);

    this.#assign.set(node, {
      x: Math.round(right + APPLY_PLACE.pageGap),
      y: Math.round(Math.min(...others.map((child) => child.y), 0)),
    });
  }
}

export const NEW_LAYERS = new InjectionToken<NewLayers>("NewLayers");
