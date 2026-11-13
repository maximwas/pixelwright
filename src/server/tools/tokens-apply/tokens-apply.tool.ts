import { inject, injectable } from "@needle-di/core";
import type { PlannedTokens } from "@/core/tokens/plan/plan.types.ts";
import { TOKENS_PLAN } from "@/core/tokens/plan/tokens-plan.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import { TOKENS_APPLY_TEXT } from "@/server/tools/tokens-apply/tokens-apply.constants.ts";
import {
  type TokensApplyInput,
  TokensApplyInputSchema,
  type TokensApplyOutput,
} from "@/server/tools/tokens-apply/tokens-apply.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

/**
 * tokens_apply (T-165): the file's tokens read through the variables op as tokens_read reads them (the libraries' the
 * page uses, and those the enabled libraries offer, so neither is copied), and core's plan set against them; a dry
 * run answers what it would make and change and what cannot be written, with Allow edits off too. A real run is
 * refused before anything is read: the plugin's writer comes with the next item.
 */
@injectable()
export class TokensApplyTool extends WriteTool<TokensApplyInput, PlannedTokens, TokensApplyOutput, TokensApplyOutput> {
  protected readonly input = TokensApplyInputSchema;
  // shortcut: the tokens op comes with the plugin's writer; until then no run reaches the versioned write.
  protected readonly op = variablesOp;
  readonly #planner;

  constructor(
    session = inject(PLUGIN_SESSION),
    versioned = inject(VERSIONED_WRITE),
    support = inject(SUPPORT_NOTE),
    planner = inject(TOKENS_PLAN),
  ) {
    super(session, versioned, support);
    this.#planner = planner;
  }

  protected async prepare({ tokens, dryRun }: TokensApplyInput): Promise<PlannedTokens> {
    if (!dryRun) {
      throw this.#refused();
    }

    const raw = await this.session.run(variablesOp, { libraries: true, used: true });

    return this.#planner.plan(tokens, raw);
  }

  /** Every run is a dry run's until tokens are written: the plan's answer, no plugin write and no version. */
  protected override answerNow({ created, updated, errors, notes }: PlannedTokens): TokensApplyOutput {
    return { created, updated, errors, ...(notes.length === 0 ? {} : { notes }), dry: true };
  }

  protected async write(): Promise<TokensApplyOutput> {
    throw this.#refused();
  }

  protected changes({ created, updated }: TokensApplyOutput): number {
    return created.length + updated.length;
  }

  protected output(result: TokensApplyOutput, fields: WriterOutput): TokensApplyOutput {
    return { ...result, ...fields };
  }

  #refused(): PixelwrightError {
    return new PixelwrightError(ERROR_CODE.opFailed, TOKENS_APPLY_TEXT.dryOnly);
  }
}
