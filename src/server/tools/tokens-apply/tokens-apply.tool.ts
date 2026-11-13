import { inject, injectable } from "@needle-di/core";
import type { PlannedTokens } from "@/core/tokens/plan/plan.types.ts";
import { TOKENS_PLAN } from "@/core/tokens/plan/tokens-plan.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import {
  type TokensApplyInput,
  TokensApplyInputSchema,
  type TokensApplyOutput,
} from "@/server/tools/tokens-apply/tokens-apply.schema.ts";
import { tokensApplyOp } from "@/shared/ops/tokens-apply/tokens-apply.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

/** Core's plan of the call, and whether it is a dry run. */
interface Prepared {
  readonly planned: PlannedTokens;
  readonly dryRun: boolean;
}

/** What the plugin's writer answers. */
type Written = Pick<TokensApplyOutput, "created" | "updated" | "errors" | "notes">;

/**
 * tokens_apply (T-165, T-166): the file's tokens read through the variables op as tokens_read reads them (the
 * libraries' the page uses, and those the enabled libraries offer, so neither is copied), and core's plan set against
 * them. A plan with nothing to write answers at once, with no version (tokens_read's own JSON, D-25); else the plugin's
 * tokens op writes it through the versioned write, a dry run too, so it refuses the modes the file's Figma plan has
 * refused (B-055). The plan's errors and notes come before the writer's.
 */
@injectable()
export class TokensApplyTool extends WriteTool<TokensApplyInput, Prepared, TokensApplyOutput, TokensApplyOutput> {
  protected readonly input = TokensApplyInputSchema;
  protected readonly op = tokensApplyOp;
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

  protected async prepare({ tokens, dryRun }: TokensApplyInput): Promise<Prepared> {
    const raw = await this.session.run(variablesOp, { libraries: true, used: true });

    return { planned: this.#planner.plan(tokens, raw), dryRun: dryRun ?? false };
  }

  /** Nothing to write: the plan's answer, no plugin write and no version. */
  protected override answerNow({ planned, dryRun }: Prepared): TokensApplyOutput | undefined {
    const { collections, styles } = planned.plan;

    if (collections.length > 0 || Object.values(styles).some((group) => group.length > 0)) {
      return undefined;
    }

    return {
      ...this.#answer(planned, { created: [], updated: [], errors: [] }),
      ...(dryRun ? { dry: true as const } : {}),
    };
  }

  protected async write({ planned }: Prepared, dry: boolean): Promise<TokensApplyOutput> {
    return this.#answer(planned, await this.session.run(tokensApplyOp, { plan: planned.plan, dryRun: dry }));
  }

  protected changes({ created, updated }: TokensApplyOutput): number {
    return created.length + updated.length;
  }

  protected output(result: TokensApplyOutput, fields: WriterOutput): TokensApplyOutput {
    return { ...result, ...fields };
  }

  /** What the writer made and changed (or would), the plan's errors and notes before its own. */
  #answer(planned: PlannedTokens, written: Written): TokensApplyOutput {
    const notes = [...planned.notes, ...(written.notes ?? [])];

    return {
      created: written.created,
      updated: written.updated,
      errors: [...planned.errors, ...written.errors],
      ...(notes.length === 0 ? {} : { notes }),
    };
  }
}
