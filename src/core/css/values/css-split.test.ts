import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CssSplit } from "@/core/css/values/css-split.ts";

const splitter = new CssSplit();

/** Values whose separators sit only inside parentheses or quotes. */
const ATOMS = [
  "a",
  "1px",
  "rgba(0, 0, 0, 0.5)",
  "'b, c / d'",
  'url("a (1).png")',
  "var(--x, 1px 2px)",
  "calc(1px / 2)",
];

describe("CssSplit", () => {
  // C-015: the @csstools tokenizer replaced every regex splitter.
  it("splits outside quotes, parentheses and comments", () => {
    expect(splitter.split("'Foo, Bar', sans-serif", ",")).toEqual(["'Foo, Bar'", "sans-serif"]);
    expect(splitter.split("0 5px 0 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px #000", ",")).toEqual([
      "0 5px 0 0 rgba(0, 0, 0, 0.25)",
      "inset 0 0 0 1px #000",
    ]);
    expect(splitter.split('url("a (1).png") center / cover', " ")).toEqual([
      'url("a (1).png")',
      "center",
      "/",
      "cover",
    ]);
    expect(splitter.split("1 / span 2", "/")).toEqual(["1", "span 2"]);
    expect(splitter.split("10px /* gap */ 20px", " ")).toEqual(["10px", "20px"]);
  });

  it("never splits inside parentheses or quotes, whatever the values", () => {
    for (const [separator, joint] of [
      [",", ", "],
      [" ", " "],
      ["/", " / "],
    ] as const) {
      fc.assert(
        fc.property(fc.array(fc.constantFrom(...ATOMS), { minLength: 1, maxLength: 6 }), (parts) => {
          expect(splitter.split(parts.join(joint), separator)).toEqual(parts);
        }),
      );
    }
  });
});
