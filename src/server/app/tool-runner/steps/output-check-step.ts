import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { OUTPUT_CHECK } from "@/server/app/tool-runner/steps/steps.constants.ts";
import type { ToolAnswer, ToolCall, ToolCallStep, ToolStepNext } from "@/server/app/tool-runner/tool-runner.ts";

/**
 * Checks every answer against its tool's outputSchema before it leaves (T-004). An answer outside it is a bug, so it
 * fails here, with the issues in the log, instead of reaching the client as the SDK's validation text. A tool without
 * one answers in text blocks only, with nothing to check.
 */
@injectable()
export class OutputCheckStep implements ToolCallStep {
  async handle(call: ToolCall, next: ToolStepNext): Promise<ToolAnswer> {
    const answer = await next(call);
    const { output } = call.manifest;

    if (output === undefined) {
      return answer;
    }

    const checked = zod.safeParse(output, answer.structuredContent);

    if (!checked.success) {
      throw new Error(OUTPUT_CHECK.mismatch(zod.prettifyError(checked.error)));
    }

    return answer;
  }
}
