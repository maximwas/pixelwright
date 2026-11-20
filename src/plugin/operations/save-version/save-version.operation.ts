import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import type { saveVersionOp } from "@/shared/ops/save-version/save-version.manifest.ts";

type SaveVersionInput = zod.output<typeof saveVersionOp.input>;

type SaveVersionOutput = zod.output<typeof saveVersionOp.output>;

/**
 * A named version with its description (P-025). Its write turn starts once every write before it has ended, so the
 * version holds Pixelwright's own writes without waiting on a timer; Allow edits is the central guard's.
 */
@injectable()
export class SaveVersionOperation extends Operation<SaveVersionInput, SaveVersionOutput> {
  readonly #history;

  constructor(report = inject(OP_REPORT), history = inject(FILE_HISTORY)) {
    super(report);
    this.#history = history;
  }

  protected async execute({ title, description }: SaveVersionInput): Promise<SaveVersionOutput> {
    return { id: await this.#history.saveVersion(title, description) };
  }
}
