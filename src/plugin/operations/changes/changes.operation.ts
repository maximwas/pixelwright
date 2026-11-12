import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CHANGE_JOURNAL } from "@/plugin/app/journal/change-journal.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import type { changesOp } from "@/shared/ops/changes/changes.manifest.ts";

/** What the journal holds after a cursor (T-035): no Figma call, so it answers at once, a write running or not. */
@injectable()
export class ChangesOperation extends Operation<
  zod.output<typeof changesOp.input>,
  zod.output<typeof changesOp.output>
> {
  readonly #journal;

  constructor(report = inject(OP_REPORT), journal = inject(CHANGE_JOURNAL)) {
    super(report);
    this.#journal = journal;
  }

  protected async execute({ since }: zod.output<typeof changesOp.input>): Promise<zod.output<typeof changesOp.output>> {
    return this.#journal.changes(since);
  }
}
