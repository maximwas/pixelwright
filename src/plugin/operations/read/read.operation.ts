import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_READER } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { OutermostLayers } from "@/plugin/operations/read/outermost-layers.ts";
import { READ_TEXT } from "@/plugin/operations/read/read.constants.ts";
import { READ_RUN } from "@/plugin/operations/read/read-run.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import type { readOp } from "@/shared/ops/read/read.manifest.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_MODEL, READ_PROFILE } from "@/shared/read-model/read-model.constants.ts";

type ReadInput = zod.output<typeof readOp.input>;

type ReadOutput = zod.output<typeof readOp.output>;

/** An id asked for, with its layer and the page it is on; null when Figma gives no layer on a page for it. */
interface Found {
  readonly id: string;
  readonly root: { readonly node: SceneNode; readonly page: { readonly id: string; readonly name: string } } | null;
}

type Root = NonNullable<Found["root"]>;

/**
 * Layers as the read model (A§9.4): each id looked up once, one Figma cannot give listed as missing rather than failing
 * the read (P-070); the layers read breadth first under the call's JSON budget (T-053), a model each, in the order
 * asked, with the page each is on (T-206). The document and its pages are refused: a read starts at a layer.
 */
@injectable()
export class ReadOperation extends Operation<ReadInput, ReadOutput> {
  readonly #lookup;
  readonly #reader;
  readonly #run;
  readonly #outermost = new OutermostLayers();

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    reader = inject(LAYER_READER),
    run = inject(READ_RUN),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#reader = reader;
    this.#run = run;
  }

  protected async execute({ nodes, depth, pathHash, ancestors, profile }: ReadInput): Promise<ReadOutput> {
    const apply = profile === READ_PROFILE.apply;
    const found = await Promise.all([...new Set(nodes)].map(async (id) => this.#found(id, apply)));
    const reached = found.flatMap(({ root }) => (root === null ? [] : [root]));
    const roots = apply ? this.#outermostRoots(reached) : reached;

    this.#reader.start({ pathHash: pathHash ?? false });

    const read = await this.#run.read(
      roots.map(({ node }) => node),
      this.#reader,
      { depth, ancestors, jsonChars: LIMITS.readJsonChars },
    );

    const parents = apply ? await Promise.all(roots.map(async ({ node }) => this.#parentEntry(node))) : [];

    // ReadRun answers an entry per root, in the order given, and the layers above each when asked; the apply profile
    // always lists the layer each root sits in, and only that.
    const pairs = read.layers.flatMap((layer, index) => {
      const root = roots[index];
      const above = apply ? parents[index] : read.ancestors[index];

      return root === undefined ? [] : [{ layer, ...root, ...(above === undefined ? {} : { ancestors: above }) }];
    });
    const reads = await Promise.all(
      pairs.map(async ({ layer, node, page, ...above }) => ({
        model: READ_MODEL.version,
        profile: apply ? READ_PROFILE.apply : READ_PROFILE.design,
        root: layer,
        ...above,
        ...(await this.#reader.tables(layer, node)),
        page,
      })),
    );

    return { reads, missing: found.flatMap(({ id, root }) => (root === null ? [id] : [])), cuts: read.cuts };
  }

  /**
   * The layer of an id with its page, or null: Figma throws for a lookup it cannot answer (offline, an instance's hidden
   * layer gone: FX-015), and a layer on no page was removed meanwhile.
   */
  async #found(id: string, apply: boolean): Promise<Found> {
    const node = await this.#lookup.node(id).catch(() => null);

    // The apply profile takes a page or document id for an id the file lacks as a layer: design_apply sends it on.
    if (node === null || (apply && this.#isContainer(node))) {
      return { id, root: null };
    }

    const layer = this.#layer(node);
    const page = this.#lookup.pageOf(layer);

    return { id, root: page === null ? null : { node: layer, page: { id: page.id, name: page.name } } };
  }

  #isContainer(node: BaseNode): boolean {
    return node.type === FIGMA_NODE_TYPE.document || node.type === FIGMA_NODE_TYPE.page;
  }

  /** The named layers no other named layer holds (P-118), in the order asked. */
  #outermostRoots(roots: readonly Root[]): Root[] {
    const kept = new Set(
      this.#outermost.of(
        roots.map(({ node }) => node.id),
        (id) => this.#idsAbove(roots.find(({ node }) => node.id === id)?.node),
      ),
    );

    return roots.filter(({ node }) => kept.has(node.id));
  }

  #idsAbove(node: SceneNode | undefined): string[] {
    const above: string[] = [];

    for (
      let parent = node === undefined ? null : this.#reader.parent(node);
      parent !== null;
      parent = this.#reader.parent(parent)
    ) {
      above.push(parent.id);
    }

    return above;
  }

  /** The layer a root sits in, as a bare entry: where design_apply learns how the root is laid out and placed. */
  async #parentEntry(node: SceneNode): Promise<ReadLayer[] | undefined> {
    const parent = this.#reader.parent(node);

    return parent === null ? undefined : [await this.#reader.entry(parent, node)];
  }

  #layer(node: BaseNode): SceneNode {
    if (node.type === FIGMA_NODE_TYPE.document || node.type === FIGMA_NODE_TYPE.page) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, READ_TEXT.notLayer(node.id, node.type));
    }

    return node;
  }
}
