import { WRITE_ERROR_NAME } from "@/plugin/adapters/figma/figma.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * A write that cannot be done, with what to do instead (P-081): design_apply returns both on the attribute's error.
 * `keys` names the props that caused it when a step writes several (a gap's token in the layout step).
 */
export class WriteError extends Error {
  readonly hint: string | undefined;
  readonly keys: readonly (keyof FigmaProps)[] | undefined;

  constructor(
    message: string,
    hint?: string,
    keys?: readonly (keyof FigmaProps)[],
  ) {
    super(message);
    this.name = WRITE_ERROR_NAME;
    this.hint = hint;
    this.keys = keys;
  }
}
