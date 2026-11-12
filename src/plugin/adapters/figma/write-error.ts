import { WRITE_ERROR_NAME } from "@/plugin/adapters/figma/figma.constants.ts";

/** A write that cannot be done, with what to do instead (P-081): design_apply returns both on the attribute's error. */
export class WriteError extends Error {
  readonly hint: string | undefined;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = WRITE_ERROR_NAME;
    this.hint = hint;
  }
}
