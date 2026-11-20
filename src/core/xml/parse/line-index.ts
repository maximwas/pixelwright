import { XML_PARSE } from "@/core/xml/parse/parse.constants.ts";
import type { XmlLocation } from "@/core/xml/parse/parse.types.ts";

/** Line starts of one source, found once; a position is found by halving, so 20,000 lines cost a handful of steps (D-67). */
export class LineIndex {
  readonly #starts: number[] = [0];

  constructor(source: string) {
    for (
      let newline = source.indexOf(XML_PARSE.chars.newline);
      newline !== -1;
      newline = source.indexOf(XML_PARSE.chars.newline, newline + 1)
    ) {
      this.#starts.push(newline + 1);
    }
  }

  /** The line and column of an index: the last line starting at or before it. */
  locate(index: number): XmlLocation {
    let line = 0;

    for (let high = this.#starts.length - 1; line < high; ) {
      const middle = Math.ceil((line + high) / 2);

      if ((this.#starts[middle] ?? 0) <= index) {
        line = middle;
      } else {
        high = middle - 1;
      }
    }

    return { line: line + 1, column: index - (this.#starts[line] ?? 0) + 1 };
  }
}
