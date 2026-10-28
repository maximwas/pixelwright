import type { ErrorCode } from "@/shared/errors/error-code.constants.ts";
import { PIXELWRIGHT_ERROR } from "@/shared/errors/errors.constants.ts";

/** An expected failure: the call cannot answer, and its code tells the model what to do next (T-003). */
export class PixelwrightError extends Error {
  readonly code: ErrorCode;

  constructor(
    code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = PIXELWRIGHT_ERROR.name;
    this.code = code;
  }

  /** The text the MCP client shows: the code first. */
  text(): string {
    return PIXELWRIGHT_ERROR.text(this.code, this.message);
  }
}
