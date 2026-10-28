import { injectable } from "@needle-di/core";
import { PixelwrightError } from "../../../../shared/errors/pixelwright-error.ts";
import type { ToolAnswer, ToolCall, ToolCallStep, ToolStepNext } from "../tool-runner.types.ts";

/**
 * The outermost step: a failed call becomes an isError answer. An expected failure reads `CODE: message`, so the model
 * can act on the code (T-003); a bug shows only its first line, and the log has the rest.
 */
@injectable()
export class ErrorTextStep implements ToolCallStep {
  async handle(
    call: ToolCall,
    next: ToolStepNext,
  ): Promise<ToolAnswer> {
    try {
      return await next(call);
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: this.#text(call, error),
          },
        ],
      };
    }
  }

  #text(
    call: ToolCall,
    error: unknown,
  ): string {
    if (error instanceof PixelwrightError) {
      return error.text();
    }

    const firstLine = (error instanceof Error ? error.message : String(error)).split("\n")[0];

    return `Internal error in ${call.manifest.name}: ${firstLine}; see pixelwright logs`;
  }
}
