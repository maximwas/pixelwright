import { inject, injectable } from "@needle-di/core";
import { VARIANT_DIFF } from "@/core/diff/variant-diff.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { VARIANTS_READ_TEXT } from "@/server/tools/variants-read/variants-read.constants.ts";
import {
  type VariantsReadAnswer,
  type VariantsReadInput,
  VariantsReadInputSchema,
} from "@/server/tools/variants-read/variants-read.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { setOfOp } from "@/shared/ops/set-of/set-of.manifest.ts";

/**
 * variants_read (T-086): the set_of op finds the set of a set, variant or instance, the read op reads it whole on the
 * same file, and core's VariantDiff compares its variants with the default. Reads only.
 */
@injectable()
export class VariantsReadTool extends Tool<VariantsReadInput, VariantsReadAnswer> {
  protected readonly input = VariantsReadInputSchema;
  readonly #session;
  readonly #variants;

  constructor(session = inject(PLUGIN_SESSION), variants = inject(VARIANT_DIFF)) {
    super();
    this.#session = session;
    this.#variants = variants;
  }

  protected async run({ node }: VariantsReadInput): Promise<VariantsReadAnswer> {
    const set = await this.#session.run(setOfOp, { node });
    const {
      reads: [model],
      cuts,
    } = await this.#session.run(readOp, { nodes: [set.id], pathHash: true });

    if (model === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(set.id));
    }

    const view = this.#variants.view(model);

    // A set has no depth to ask for: every cut is the budget's.
    return cuts.length === 0 ? view : { ...view, cut: VARIANTS_READ_TEXT.cut(cuts.length) };
  }
}
