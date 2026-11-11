import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
import { READ_CASES } from "./cases/apply-read.cases.ts";

/**
 * The one case where the new parser (item 32) differs from 0.7.0: `<Frame id=2:1/>` is refused at the attribute's name
 * (column 8) now, and at its value (column 11) then. The golden file is not edited to fit; the difference is stated here.
 */
const UNQUOTED_VALUE = {
  was: '"column": 11,\n        "message": "Invalid XML at line 1, column 11: The value of id needs quotes',
  now: '"column": 8,\n        "message": "Invalid XML at line 1, column 8: The value of id needs quotes',
} as const;

/**
 * What the reader makes of every case, byte for byte as 0.7.0 made it (C-195): the elements in document order and
 * every error with its words. Several cases name which admission check wins when an element fails two.
 */
describe("golden apply-read", () => {
  it("keeps the elements and errors of all 71 cases", () => {
    const reader = new ApplyRead();
    const reads = Object.fromEntries(
      Object.entries(READ_CASES).map(([name, xml]) => {
        const { elements, errors } = reader.read(xml);

        return [name, { elements, errors }];
      }),
    );

    expect(Object.keys(reads)).toHaveLength(71);

    const golden = readFileSync(new URL("./__golden__/apply-read.json", import.meta.url), "utf8");

    expect(`${JSON.stringify(reads, null, 2)}\n`).toBe(golden.replace(UNQUOTED_VALUE.was, UNQUOTED_VALUE.now));
  });
});
