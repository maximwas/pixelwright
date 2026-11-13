import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { STYLE_WRITER } from "@/plugin/operations/tokens-apply/style-writer.ts";
import type { TokenRun } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { VARIABLE_WRITER } from "@/plugin/operations/tokens-apply/variable-writer.ts";
import type { tokensApplyOp } from "@/shared/ops/tokens-apply/tokens-apply.manifest.ts";

type TokensApplyInput = zod.output<typeof tokensApplyOp.input>;

type TokensApplyOutput = zod.output<typeof tokensApplyOp.output>;

/**
 * The `tokens_apply` op (T-165, T-166, P-163): core's plan written in Figma, collections and variables first, then the
 * styles that may bind the variables just made; what Figma refuses is that token's error while the rest is written,
 * and everything written is one undo step, a call stopped halfway too. A dry run walks the same way and writes nothing;
 * Allow edits is checked before a real one runs (P-010).
 */
@injectable()
export class TokensApplyOperation extends Operation<TokensApplyInput, TokensApplyOutput> {
  readonly #variables;
  readonly #styles;
  readonly #history;

  constructor(
    report = inject(OP_REPORT),
    variables = inject(VARIABLE_WRITER),
    styles = inject(STYLE_WRITER),
    history = inject(FILE_HISTORY),
  ) {
    super(report);
    this.#variables = variables;
    this.#styles = styles;
    this.#history = history;
  }

  protected async execute({ plan, dryRun }: TokensApplyInput): Promise<TokensApplyOutput> {
    const run: TokenRun = {
      dryRun,
      answer: { created: [], updated: [], errors: [], notes: [] },
      local: new Map(),
      made: new Map(),
      wrote: false,
    };

    try {
      await this.#variables.write(plan.collections, run);
      await this.#styles.write(plan.styles, plan.targets ?? {}, run);
    } finally {
      if (run.wrote) {
        this.#history.commitUndo();
      }
    }

    const { notes, ...answer } = run.answer;

    return notes.length === 0 ? answer : run.answer;
  }
}
