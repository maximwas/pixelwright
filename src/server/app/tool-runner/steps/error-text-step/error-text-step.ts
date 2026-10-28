import { injectable } from "@needle-di/core";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type {
  ToolAnswer,
  ToolCall,
  ToolCallStep,
  ToolStepNext,
} from "@/server/app/tool-runner/tool-runner/tool-runner.types.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";
import { ERROR_TEXT } from "./error-text-step.constants.ts";

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
            type: TOOL_CONTENT_TYPE.text,
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

    const firstLine = (error instanceof Error ? error.message : String(error)).split(ERROR_TEXT.lineBreak)[0];

    return ERROR_TEXT.internal(call.manifest.name, firstLine);
  }
}
