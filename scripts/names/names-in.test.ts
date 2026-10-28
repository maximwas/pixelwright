import { describe, expect, it } from "vitest";
import { namesIn } from "./names-in.ts";

// Built at run time, so this file itself carries no listed name.
const NAME = ["Max", "im"].join("");

describe("namesIn", () => {
  it("finds a listed name in a comment, with its line", () => {
    expect(namesIn(`const a = 1;\n// as ${NAME} asked\n`)).toEqual([
      {
        line: 2,
        word: NAME,
      },
    ]);
  });

  it("finds a listed name inside a camelCase identifier", () => {
    expect(namesIn(`const ${NAME.toLowerCase()}Settings = {};`)).toEqual([
      {
        line: 1,
        word: NAME.toLowerCase(),
      },
    ]);
  });

  it("leaves longer words that only start with a name", () => {
    expect(namesIn(`const ${NAME.toLowerCase()}um = 3;`)).toEqual([]);
  });
});
