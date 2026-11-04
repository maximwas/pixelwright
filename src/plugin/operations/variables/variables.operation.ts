import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { FILE_TOKENS } from "@/plugin/adapters/figma/variables/file-tokens.ts";
import { LIBRARY_CATALOGUE } from "@/plugin/adapters/figma/variables/library-catalogue.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import type { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

type VariablesInput = zod.output<typeof variablesOp.input>;

type VariablesOutput = zod.output<typeof variablesOp.output>;

/**
 * The variables op (P-125): the file's tokens as Figma keeps them, with the ones the layers in `within` (or on the
 * current page) use when asked, and the enabled libraries' variables by name when asked, all within one budget. The
 * server builds the token model: the plugin carries no core/tokens.
 */
@injectable()
export class VariablesOperation extends Operation<VariablesInput, VariablesOutput> {
  readonly #tokens;
  readonly #catalogue;
  readonly #walk;

  constructor(
    report = inject(OP_REPORT),
    tokens = inject(FILE_TOKENS),
    catalogue = inject(LIBRARY_CATALOGUE),
    walk = inject(LAYER_WALK),
  ) {
    super(report);
    this.#tokens = tokens;
    this.#catalogue = catalogue;
    this.#walk = walk;
  }

  protected async execute({ libraries, ...asked }: VariablesInput): Promise<VariablesOutput> {
    const deadline = this.#walk.deadline();
    const raw = await this.#tokens.read(asked, deadline);

    return libraries ? { ...raw, ...(await this.#catalogue.read(deadline)) } : raw;
  }
}
