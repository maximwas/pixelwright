import { inject, injectable } from "@needle-di/core";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { APPLY_RUN, type ApplyInput, type ApplyOutput } from "@/plugin/operations/apply/apply-run.ts";

/**
 * The `apply` op (T-120..T-123): design_apply's planned changes written in Figma, each element on its own, the whole
 * call one undo step; a dry run runs the same checks and writes nothing. Allow edits is checked before it runs (P-010).
 */
@injectable()
export class ApplyOperation extends Operation<ApplyInput, ApplyOutput> {
  readonly #run;

  constructor(report = inject(OP_REPORT), run = inject(APPLY_RUN)) {
    super(report);
    this.#run = run;
  }

  protected async execute(input: ApplyInput): Promise<ApplyOutput> {
    return await this.#run.run(input);
  }

  /** The layers a real call made and wrote to: the journal makes their changes Pixelwright's (D-53). */
  protected override touched({ created, changed }: ApplyOutput, { dryRun }: ApplyInput): readonly string[] {
    return dryRun ? [] : [...created.flatMap(({ id }) => (id === undefined ? [] : [id])), ...changed];
  }
}
