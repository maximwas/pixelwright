import type { ErrorCode } from "../error-code.constants.ts";

/** An expected failure: the call cannot answer, and its code tells the model what to do next (T-003). */
export class PixelwrightError extends Error {
  readonly code: ErrorCode;

  constructor(
    code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PixelwrightError";
    this.code = code;
  }

  /** The text the MCP client shows: the code first. */
  text(): string {
    return `${this.code}: ${this.message}`;
  }
}
