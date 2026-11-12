import { describe, expect, it } from "vitest";
import { StyleNumbers } from "@/core/tokens/names/style-numbers.ts";

// T-163, B-044, D-29: one numbering for every reader; the file's own styles first, by id, then library ones.
describe("styles that share a name", () => {
  it("are numbered by kind and name: the file's own by id, then library ones", () => {
    const numbers = new StyleNumbers().numbers([
      { id: "S:2", type: "PAINT", name: "Black", remote: false },
      { id: "S:1", type: "PAINT", name: "Black", remote: false },
      { id: "S:0", type: "PAINT", name: "Black", remote: true },
      { id: "S:1", type: "PAINT", name: "Black", remote: false },
      { id: "S:3", type: "TEXT", name: "Black", remote: false },
      { id: "S:4", type: "PAINT", name: "White", remote: false },
    ]);

    expect([...numbers]).toEqual([
      ["S:1", 1],
      ["S:2", 2],
      ["S:0", 3],
    ]);
  });
});
