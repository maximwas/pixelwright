import { describe, expect, it } from "vitest";
import { applyTextEdits, textEdits } from "../src/index.ts";

const replaced = (characters: string, replacements: Parameters<typeof textEdits>[1]) =>
  applyTextEdits(characters, textEdits(characters, replacements));

describe("textEdits: what texts_replace changes in one text", () => {
  it("replaces every occurrence, ignoring case unless asked not to", () => {
    expect(
      replaced("Plan, plan, PLAN", [
        {
          find: "plan",
          replace: "tier",
        },
      ]),
    ).toBe("tier, tier, tier");
    expect(
      replaced("Plan, plan, PLAN", [
        {
          find: "plan",
          replace: "tier",
          caseSensitive: true,
        },
      ]),
    ).toBe("Plan, tier, PLAN");
  });

  it("matches whole words only when asked, in any script", () => {
    expect(
      replaced("Pro, Prototype, pro.", [
        {
          find: "pro",
          replace: "Plus",
          wholeWord: true,
        },
      ]),
    ).toBe("Plus, Prototype, Plus.");
    expect(
      replaced("Ціна ціни", [
        {
          find: "ціна",
          replace: "вартість",
          wholeWord: true,
        },
      ]),
    ).toBe("вартість ціни");
  });

  it("applies a dictionary at once to the text as it was, so one pair never feeds another", () => {
    expect(
      replaced("Sign in to Orbit", [
        {
          find: "Sign in",
          replace: "Log in",
        },
        {
          find: "Log in",
          replace: "Enter",
        },
        {
          find: "Orbit",
          replace: "Orbit Pro",
        },
      ]),
    ).toBe("Log in to Orbit Pro");
  });

  it("prefers the earliest match, then the longest, where pairs overlap", () => {
    expect(
      replaced("New York City", [
        {
          find: "York",
          replace: "Y",
        },
        {
          find: "New York",
          replace: "NY",
        },
      ]),
    ).toBe("NY City");
  });

  it("takes a regular expression with its groups", () => {
    expect(
      replaced("$12 / mo, $120 / yr", [
        {
          find: "\\$(\\d+)",
          replace: "€$1",
          regex: true,
        },
      ]),
    ).toBe("€12 / mo, €120 / yr");
    expect(
      replaced("2026-10-17", [
        {
          find: "(?<y>\\d{4})-(\\d\\d)",
          replace: "$2/$<y>",
          regex: true,
        },
      ]),
    ).toBe("10/2026-17");
  });

  it("gives each edit's place in the text as it was, and none for an empty match", () => {
    expect(
      textEdits("a-b", [
        {
          find: "-",
          replace: "",
        },
      ]),
    ).toEqual([
      {
        start: 1,
        end: 2,
        text: "",
      },
    ]);
    expect(
      textEdits("abc", [
        {
          find: "x*",
          replace: "y",
          regex: true,
        },
      ]),
    ).toEqual([]);
  });

  it("says what is wrong with a regular expression", () => {
    expect(() =>
      textEdits("a", [
        {
          find: "(",
          replace: "",
          regex: true,
        },
      ]),
    ).toThrow(/is not a regular expression/);
  });
});
