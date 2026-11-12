import { tokenOf, withTokenValues } from "../../css-mapping/values/css-values.ts";
import type { Longhand, LonghandKind } from "./types.ts";

/** A layer's values read with the read's tokens: what a value shows, and which var() it is when it is one. */
export class DesignValues {
  readonly #tokens: Readonly<Record<string, string>>;

  constructor(tokens: Readonly<Record<string, string>>) {
    this.#tokens = tokens;
  }

  /** A value with its tokens' values in. */
  resolved(written: string): string {
    return withTokenValues(written, this.#tokens);
  }

  /** A longhand of a value as written: its tokens' values in, and the var() it comes from when it is one. */
  longhand(property: string, kind: LonghandKind, written: string): Longhand {
    const value = this.resolved(written);
    const token = tokenOf(written) !== null && value !== written.trim();

    return {
      property,
      kind,
      value,
      design: value,
      ...(token ? { from: written.trim() } : {}),
    };
  }
}
