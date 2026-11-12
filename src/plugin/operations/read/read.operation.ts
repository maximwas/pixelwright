import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_READER } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { READ_TEXT } from "@/plugin/operations/read/read.constants.ts";
import { READ_RUN } from "@/plugin/operations/read/read-run.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import type { readOp } from "@/shared/ops/read/read.manifest.ts";
import { READ_MODEL, READ_PROFILE } from "@/shared/read-model/read-model.constants.ts";

type ReadInput = zod.output<typeof readOp.input>;

type ReadOutput = zod.output<typeof readOp.output>;

/** An id asked for, with its layer and the page it is on; null when Figma gives no layer on a page for it. */
interface Found {
  readonly id: string;
  readonly root: { readonly node: SceneNode; readonly page: { readonly id: string; readonly name: string } } | null;
}

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

  protected async execute({ nodes, depth, pathHash, ancestors }: ReadInput): Promise<ReadOutput> {
    const found = await Promise.all([...new Set(nodes)].map(async (id) => this.#found(id)));
    const roots = found.flatMap(({ root }) => (root === null ? [] : [root]));

    this.#reader.start({ pathHash: pathHash ?? false });

    const read = await this.#run.read(
      roots.map(({ node }) => node),
      this.#reader,
      { depth, ancestors, jsonChars: LIMITS.readJsonChars },
    );

    // ReadRun answers an entry per root, in the order given, and the layers above each when asked.
    const pairs = read.layers.flatMap((layer, index) => {
      const root = roots[index];
      const above = read.ancestors[index];

      return root === undefined ? [] : [{ layer, ...root, ...(above === undefined ? {} : { ancestors: above }) }];
    });
    const reads = await Promise.all(
      pairs.map(async ({ layer, node, page, ...above }) => ({
        model: READ_MODEL.version,
        profile: READ_PROFILE.design,
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
  async #found(id: string): Promise<Found> {
    const node = await this.#lookup.node(id).catch(() => null);

    if (node === null) {
      return { id, root: null };
    }

    const layer = this.#layer(node);
    const page = this.#lookup.pageOf(layer);

    return { id, root: page === null ? null : { node: layer, page: { id: page.id, name: page.name } } };
  }

  #layer(node: BaseNode): SceneNode {
    if (node.type === FIGMA_NODE_TYPE.document || node.type === FIGMA_NODE_TYPE.page) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, READ_TEXT.notLayer(node.id, node.type));
    }

    return node;
  }
}
