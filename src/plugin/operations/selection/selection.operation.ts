import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CURRENT_SELECTION } from "@/plugin/adapters/figma/current-selection.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import type { selectionOp } from "@/shared/ops/selection/selection.manifest.ts";

/** The layers the user selected on the current page (T-030); none selected is an empty list. */
@injectable()
export class SelectionOperation extends Operation<
  zod.output<typeof selectionOp.input>,
  zod.output<typeof selectionOp.output>
> {
  readonly #selection;

  constructor(report = inject(OP_REPORT), selection = inject(CURRENT_SELECTION)) {
    super(report);
    this.#selection = selection;
  }

  protected async execute(): Promise<zod.output<typeof selectionOp.output>> {
    return { nodes: this.#selection.nodes() };
  }
}
