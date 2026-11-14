import { describe, expect, it } from "vitest";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import type { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { TokenIndex } from "@/plugin/operations/apply/token-index.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

function raw(...variables: [string, string][]): RawTokens {
  return {
    collections: [],
    variables: variables.map(([name, resolvedType]) => ({
      id: `V:${name}`,
      name,
      collectionId: "C:1",
      resolvedType,
      scopes: [],
      valuesByMode: {},
    })),
    external: {},
    styles: [{ id: "S:1", type: TOKEN_KIND.paint, name: "Card" } as RawTokens["styles"][number]],
  };
}

/** The index over hand-made ports; `pages` is what the current page reads, one entry per call; `library` the catalogue. */
function build(pages: RawTokens[], library: NonNullable<RawTokens["library"]> = []) {
  const reads: number[] = [];
  const files = {
    read: async () => {
      reads.push(1);

      return pages[Math.min(reads.length, pages.length) - 1];
    },
    otherPages: async () => [],
  } as never;
  const catalogue = { read: async () => ({ library }) } as never;
  const lookup = { variable: async (id: string) => ({ id }) } as never;

  return { index: new TokenIndex(files, catalogue, new TokenNames(), lookup), reads };
}

async function refusal(promise: Promise<unknown>): Promise<WriteError> {
  return (await promise.then(
    () => new Error("not refused"),
    (error: unknown) => error,
  )) as WriteError;
}

describe("TokenIndex", () => {
  it("finds a variable and a paint style by their CSS names", async () => {
    const { index } = build([raw(["ink", "COLOR"])]);

    index.start(0);

    expect((await index.variable("--ink", TOKEN_KIND.colour)).id).toBe("V:ink");
    expect(await index.style("--Card", TOKEN_KIND.paint)).toBe("S:1");
    expect(await index.style("--Nope", TOKEN_KIND.paint)).toBeNull();
  });

  it("refuses a variable of another type, naming both", async () => {
    const { index } = build([raw(["gap", "FLOAT"])]);

    index.start(0);

    expect((await refusal(index.check("--gap", TOKEN_KIND.colour))).message).toBe(
      "--gap is a float variable: this needs a color one.",
    );
  });

  it("answers an unknown name with the near one, or the list when none is near", async () => {
    const { index } = build([raw(["ink", "COLOR"])]);

    index.start(0);

    expect((await refusal(index.check("--inq", TOKEN_KIND.colour))).hint).toContain("Did you mean --ink?");
    expect((await refusal(index.check("--zzzzzzzz", TOKEN_KIND.colour))).hint).toContain("tokens_read lists");
  });

  // One call's index: the file may have changed between calls.
  it("reads the file again after start() and forgets what the last call read", async () => {
    const { index, reads } = build([raw(["ink", "COLOR"]), raw(["paper", "COLOR"])]);

    index.start(0);
    await index.check("--ink", TOKEN_KIND.colour);
    await index.check("--ink", TOKEN_KIND.colour);

    expect(reads).toHaveLength(1);

    index.start(0);

    await expect(index.check("--paper", TOKEN_KIND.colour)).resolves.toBeUndefined();
    expect(reads).toHaveLength(2);
    expect((await refusal(index.check("--ink", TOKEN_KIND.colour))).message).toContain("--ink");
  });
});

/** Two collections that each have a colour variable named primary, as the blind test's file had. */
function brands(): RawTokens {
  const variable = (id: string, collectionId: string) => ({
    id,
    name: "primary",
    collectionId,
    resolvedType: "COLOR",
    scopes: [],
    valuesByMode: {},
  });

  return {
    collections: [
      { id: "C:a", name: "Brand A", remote: false, defaultModeId: "a:1", modes: [{ modeId: "a:1", name: "Violet" }] },
      { id: "C:b", name: "Brand B", remote: false, defaultModeId: "b:1", modes: [{ modeId: "b:1", name: "Indigo" }] },
    ],
    variables: [variable("V:a", "C:a"), variable("V:b", "C:b")],
    external: {},
    styles: [],
  };
}

// FIX-090A: a CSS name names a variable by its name alone, so two collections can share one; the blind test's card
// was bound to the other collection's colours, silently.
describe("TokenIndex, a CSS name two collections' variables share", () => {
  it("binds the variable of the collection whose mode the element's XML sets", async () => {
    const { index } = build([brands()]);

    index.start(0);

    const place = { layer: { type: "RECTANGLE" as const }, modes: { "brand-b": "indigo" } };

    expect((await index.variable("--primary", TOKEN_KIND.colour, place)).id).toBe("V:b");
  });

  it("binds by the nearest mode up the layers: a parent the call makes or changes, then Figma's layers above", async () => {
    const { index } = build([brands()]);
    const page = { type: "PAGE" as const, explicitVariableModes: { "C:a": "a:1" } };
    const existing = { type: "FRAME" as const, id: "1:5", parent: page };
    const made = { type: "FRAME" as const, parent: page, modes: { "Brand B": "Indigo" } };

    index.start(0, [{ id: "1:5", props: { modes: { "brand-b": "indigo" } } } as never]);

    expect(
      (await index.variable("--primary", TOKEN_KIND.colour, { layer: { type: "RECTANGLE", parent: page } })).id,
    ).toBe("V:a");
    expect(
      (await index.variable("--primary", TOKEN_KIND.colour, { layer: { type: "RECTANGLE", parent: made } })).id,
    ).toBe("V:b");
    expect(
      (await index.variable("--primary", TOKEN_KIND.colour, { layer: { type: "RECTANGLE", parent: existing } })).id,
    ).toBe("V:b");
  });

  it("refuses it on a dry run's check and a real run's write alike, naming both collections and both ways", async () => {
    const { index } = build([brands()]);

    index.start(0);

    const place = { layer: { type: "FRAME" as const } };
    const dry = await refusal(index.check("--primary", TOKEN_KIND.colour, place));
    const real = await refusal(index.variable("--primary", TOKEN_KIND.colour, place));

    expect(dry.message).toBe(
      "--primary names 2 variables, in Brand A and Brand B, and no mode set on this layer or a parent picks one.",
    );
    expect(dry.hint).toBe(
      'Set the mode of the collection you mean on this layer or a parent: data-brand-a="<mode>" or data-brand-b="<mode>". Or give one of them its own WEB code syntax with tokens_apply.',
    );
    expect([real.message, real.hint]).toEqual([dry.message, dry.hint]);
  });

  // FIX-090A2: the nearest level that sets both collections' modes cannot pick, and the refusal said no mode was set.
  it("refuses it where the nearest layer setting a mode sets both collections', saying to set only the one meant", async () => {
    const { index } = build([brands()]);

    index.start(0);

    const place = { layer: { type: "FRAME" as const }, modes: { "brand-a": "violet", "Brand B": "Indigo" } };
    const refused = await refusal(index.check("--primary", TOKEN_KIND.colour, place));

    expect([refused.message, refused.hint]).toEqual([
      "--primary names 2 variables, in Brand A and Brand B, and the nearest layer that sets a mode of theirs sets modes of Brand A and Brand B at once.",
      'Set on this element only the mode of the collection you mean: data-brand-a="<mode>" or data-brand-b="<mode>". Or give one of them its own WEB code syntax with tokens_apply.',
    ]);
  });
});

/** An enabled library of two colours, brand and accent, listed by their keys. */
const LIBRARY = [
  {
    libraryName: "Lib",
    collection: "Lib",
    key: "C:lib",
    variables: [
      { name: "brand", key: "K:brand", resolvedType: "COLOR" },
      { name: "accent", key: "K:accent", resolvedType: "COLOR" },
    ],
  },
];

/** A page that uses the library's brand: named only (its collection out of reach), or with its remote collection. */
function usesBrand(found: "named" | "remote"): RawTokens {
  const brand = { name: "brand", key: "K:brand", resolvedType: "COLOR" };

  if (found === "named") {
    return { collections: [], variables: [], external: { "V:brand": { ...brand, collection: "Lib" } }, styles: [] };
  }

  return {
    collections: [
      { id: "C:lib", name: "Lib", remote: true, defaultModeId: "lib:1", modes: [{ modeId: "lib:1", name: "Mode 1" }] },
    ],
    variables: [{ ...brand, id: "V:brand", collectionId: "C:lib", scopes: [], valuesByMode: {} }],
    external: {},
    styles: [],
  };
}

// FIX-090A2: once a token the page does not use read the library, its catalogue listed brand again by its key beside
// its id in the file, and --brand was refused as two variables.
describe("TokenIndex, a library variable the page uses", () => {
  it.each(["named", "remote"] as const)(
    "is one variable however it was found (%s), after a library token the page does not use and before one",
    async (found) => {
      const { index } = build([usesBrand(found)], LIBRARY);

      index.start(0);
      await index.check("--accent", TOKEN_KIND.colour);

      expect((await index.variable("--brand", TOKEN_KIND.colour)).id).toBe("V:brand");

      index.start(0);

      expect((await index.variable("--brand", TOKEN_KIND.colour)).id).toBe("V:brand");

      await index.check("--accent", TOKEN_KIND.colour);

      expect((await index.variable("--brand", TOKEN_KIND.colour)).id).toBe("V:brand");
    },
  );
});
