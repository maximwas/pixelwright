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

/**
 * Layers as the read model (A§9.4): each id looked up once, one Figma cannot give listed as missing rather than failing
 * the read (P-070); the layers read breadth first under the call's JSON budget (T-053), a model each, in the order
 * asked. The document and its pages are refused: a read starts at a layer.
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

  protected async execute({ nodes, depth }: ReadInput): Promise<ReadOutput> {
    // Figma throws for a lookup it cannot answer (offline, an instance's hidden layer gone): that id is missing (FX-015).
    const found = await Promise.all(
      [...new Set(nodes)].map(async (id) => ({ id, node: await this.#lookup.node(id).catch(() => null) })),
    );
    const roots = found.flatMap(({ node }) => (node === null ? [] : [this.#layer(node)]));
    const { layers, cuts } = this.#run.read(roots, this.#reader, { depth, jsonChars: LIMITS.readJsonChars });

    return {
      reads: layers.map((root) => ({
        model: READ_MODEL.version,
        profile: READ_PROFILE.design,
        root,
        colorProfile: this.#reader.colorProfile(),
        styles: {},
        variables: {},
      })),
      missing: found.filter(({ node }) => node === null).map(({ id }) => id),
      cuts,
    };
  }

  #layer(node: BaseNode): SceneNode {
    if (node.type === FIGMA_NODE_TYPE.document || node.type === FIGMA_NODE_TYPE.page) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, READ_TEXT.notLayer(node.id, node.type));
    }

    return node;
  }
}
