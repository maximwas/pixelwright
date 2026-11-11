import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
import { READ_CASES } from "./cases/apply-read.cases.ts";

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

    expect(`${JSON.stringify(reads, null, 2)}\n`).toBe(golden);
  });
});
