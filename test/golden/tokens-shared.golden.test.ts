import { describe, expect, it } from "vitest";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";
import { notesOf, plan } from "./support/tokens-planner.ts";

/** Two collections that each have a colour variable named primary (FIX-090A). */
function brands(): RawTokens {
  const collection = (
    id: string,
    name: string,
    mode: string,
  ) => ({
    id,
    name,
    remote: false,
    defaultModeId: `${id}:1`,
    modes: [{ modeId: `${id}:1`, name: mode }],
  });
  const variable = (
    id: string,
    collectionId: string,
    red: number,
  ) => ({
    id,
    name: "primary",
    collectionId,
    resolvedType: "COLOR",
    scopes: ["ALL_SCOPES"],
    valuesByMode: { [`${collectionId}:1`]: { r: red, g: 0.2, b: 0.9, a: 1 } },
  });

  return {
    collections: [collection("C:a", "Brand A", "Violet"), collection("C:b", "Brand B", "Indigo")],
    variables: [variable("V:a", "C:a", 0.5), variable("V:b", "C:b", 0.4)],
    external: {},
    styles: [],
  };
}

describe("golden tokens: a token two collections' variables share", () => {
  // The plan's map of the file's tokens kept the last collection's: the alias went to it, silently.
  it("refuses an alias to it, naming both collections, on the dry run", () => {
    const result = plan(
      { collections: [{ name: "Brand A", variables: [{ name: "link", values: { Violet: "var(--primary)" } }] }] },
      brands(),
    );

    expect(result.errors).toEqual([
      {
        kind: "variable",
        name: "link",
        collection: "Brand A",
        mode: "Violet",
        message:
          "--primary names variables in Brand A and Brand B: an alias cannot tell which. Give the one you mean its own WEB code syntax (codeSyntax WEB) with tokens_apply, and alias that.",
      },
    ]);
  });

  // :root declares it once per collection, and CSS keeps the last declaration.
  it("is noted by tokens_read, since its CSS :root keeps one of the values", () => {
    expect(notesOf(brands())).toContain(
      "--primary names variables in Brand A and Brand B: :root declares it for each, so CSS keeps the last one's value. Give one of them its own WEB code syntax with tokens_apply to keep both.",
    );
  });
});
