import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import type { ToolAnswer, ToolCall, ToolCallStep, ToolStepNext } from "../tool-runner.types.ts";

/**
 * Checks every answer against its tool's outputSchema before it leaves (T-004). An answer outside it is a bug, so it
 * fails here, with the issues in the log, instead of reaching the client as the SDK's validation text.
 */
@injectable()
export class OutputCheckStep implements ToolCallStep {
  async handle(call: ToolCall, next: ToolStepNext): Promise<ToolAnswer> {
    const answer = await next(call);
    const checked = zod.safeParse(call.manifest.output, answer.structuredContent);

    if (!checked.success) {
      throw new Error(`the answer does not match its outputSchema: ${zod.prettifyError(checked.error)}`);
    }

    return answer;
  }
}
