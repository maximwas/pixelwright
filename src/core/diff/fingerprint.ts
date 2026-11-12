import { InjectionToken, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";
import { NOT_DRAWING } from "@/core/diff/diff.constants.ts";

/**
 * What draws a layer (K-052): its read-model entry and its insides without what names or places it or says what it
 * does, so two copies of one icon draw the same wherever they sit and whichever file design_read gives them. A read
 * that hashes a vector's paths (pathHash) tells two outlines apart too.
 */
@injectable()
export class Fingerprint {
  readonly #notDrawing: ReadonlySet<string> = new Set(NOT_DRAWING);

  /** Two layers' reads (or the fields of them both hold) draw the same. */
  same(first: unknown, second: unknown): boolean {
    return isEqual(this.#drawing(first ?? null), this.#drawing(second ?? null));
  }

  #drawing(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.#drawing(item));
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !this.#notDrawing.has(key))
        .map(([key, item]) => [key, this.#drawing(item)]),
    );
  }
}

export const FINGERPRINT = new InjectionToken<Fingerprint>("Fingerprint");
