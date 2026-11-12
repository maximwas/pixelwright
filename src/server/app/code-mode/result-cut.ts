import { InjectionToken, injectable } from "@needle-di/core";
import { CUT } from "@/server/app/code-mode/code-mode.constants.ts";

/** The longest list and the longest text in a value. */
type Longest = { readonly items: number; readonly chars: number };

/**
 * Fits what a run returns to the model's context, structurally, so it stays valid JSON (Cloudflare's way, research §2):
 * every list and text past a cap is cut with a marker saying how much went, the caps the largest that fit, found by
 * halving one scale of the longest list and text. Logs keep their last lines.
 */
@injectable()
export class ResultCut {
  result(value: unknown, maxChars: number): { readonly result: unknown; readonly chars?: number } {
    const chars = this.#length(value);

    if (chars <= maxChars) {
      return { result: value };
    }

    const longest = this.#longest(value);
    let best: unknown;
    let low = 0;
    let high = 1;

    for (let round = 0; round < CUT.rounds; round += 1) {
      const scale = (low + high) / 2;
      const items = Math.max(1, Math.floor(longest.items * scale));
      const shrunk = this.#shrink(value, items, Math.max(CUT.minChars, Math.floor(longest.chars * scale)));

      if (this.#length(shrunk) <= maxChars) {
        best = shrunk;
        low = scale;
      } else {
        high = scale;
      }
    }

    return { result: best ?? this.#text(value, maxChars), chars };
  }

  /**
   * The last lines within maxChars (the last one by its end when it alone is longer), after a line that says how many
   * earlier ones were left out, the sandbox's `earlier` among them.
   */
  logs(
    lines: readonly string[],
    maxChars: number,
    earlier = 0,
  ): readonly string[] {
    const room = maxChars - CUT.markerChars;
    const last = lines.at(-1) ?? "";
    const kept =
      last.length > room ? [...lines.slice(0, -1), `${CUT.tail}${last.slice(CUT.tail.length - room)}`] : lines;
    let first = kept.length;
    let total = 0;

    while (first > 0 && total + (kept[first - 1] ?? "").length <= room) {
      first -= 1;
      total += (kept[first] ?? "").length;
    }

    return first + earlier === 0 ? kept : [CUT.lines(first + earlier), ...kept.slice(first)];
  }

  #shrink(
    value: unknown,
    items: number,
    chars: number,
  ): unknown {
    if (typeof value === "string") {
      return value.length > chars ? `${value.slice(0, chars)}${CUT.chars(value.length - chars)}` : value;
    }

    if (Array.isArray(value)) {
      const kept = value.slice(0, items).map((item: unknown) => this.#shrink(item, items, chars));

      return value.length > items ? [...kept, CUT.items(value.length - items)] : kept;
    }

    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.#shrink(item, items, chars)]));
    }

    return value;
  }

  #longest(value: unknown): Longest {
    if (typeof value === "string") {
      return { items: 0, chars: value.length };
    }

    if (typeof value !== "object" || value === null) {
      return { items: 0, chars: 0 };
    }

    const own = Array.isArray(value) ? value.length : 0;

    return Object.values(value).reduce<Longest>(
      (longest, item) => {
        const inner = this.#longest(item);

        return { items: Math.max(longest.items, inner.items), chars: Math.max(longest.chars, inner.chars) };
      },
      { items: own, chars: 0 },
    );
  }

  /** A value no cap of its lists and texts can fit (thousands of keys): its JSON's start, as text. */
  #text(value: unknown, maxChars: number): string {
    const text = JSON.stringify(value);
    const kept = maxChars - CUT.markerChars;

    return `${text.slice(0, kept)}${CUT.chars(text.length - kept)}`;
  }

  #length(value: unknown): number {
    return (JSON.stringify(value) ?? "").length;
  }
}

export const RESULT_CUT = new InjectionToken<ResultCut>("ResultCut");
