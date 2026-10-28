import { describe, expect, it } from "vitest";
import { baselineFileOf } from "../src/diff/baseline/baseline-file.ts";
import { withLiveNames } from "../src/diff/baseline/live-names.ts";
import { usedTokens } from "../src/diff/baseline/used-tokens.ts";
import type { RawTokens } from "../src/tokens/raw-tokens.ts";
import type { Snapshot } from "../src/types/snapshot.ts";
import { layer } from "./helpers/layers.ts";

const alias = (id: string) => ({
  type: "VARIABLE_ALIAS",
  id,
});
const collection = (id: string, modes: string[]) => ({
  id,
  name: id,
  remote: false,
  defaultModeId: modes[0] ?? "",
  modes: modes.map((modeId) => ({
    modeId,
    name: modeId,
  })),
});
const variable = (id: string, collectionId: string, valuesByMode: Record<string, unknown>) => ({
  id,
  name: id,
  collectionId,
  resolvedType: "COLOR",
  scopes: [],
  valuesByMode,
});
const style = (id: string, name: string) => ({
  id,
  name,
  type: "PAINT",
  remote: false,
  paints: [],
});

/** A file's tokens: a brand colour aliasing a palette entry, which aliases a library colour; others it does not use. */
const RAW: RawTokens = {
  collections: [collection("theme", ["light", "dark"]), collection("palette", ["only"]), collection("unused", ["m"])],
  variables: [
    variable("brand", "theme", {
      light: alias("blue-600"),
      dark: alias("blue-400"),
    }),
    variable("blue-600", "palette", { only: alias("lib-blue") }),
    variable("blue-400", "palette", { only: "#60A5FA" }),
    variable("stray", "unused", { m: "#000000" }),
  ],
  external: {
    "lib-blue": {
      name: "blue",
      collection: "Library",
      resolvedType: "COLOR",
    },
    "lib-red": {
      name: "red",
      collection: "Library",
      resolvedType: "COLOR",
    },
  },
  styles: [style("S:card", "Card"), style("S:other", "Other")],
  library: [
    {
      libraryName: "Kit",
      collection: "Library",
      key: "k",
      variables: [],
    },
  ],
  libraryError: "offline",
  colorProfile: "SRGB",
};

function snapshotUsing(variables: string[], styles: string[]): Snapshot {
  return {
    root: layer({
      id: "1:1",
      name: "Pricing",
    }),
    variables: Object.fromEntries(
      variables.map((id) => [
        id,
        {
          name: id,
          collection: "theme",
          resolvedType: "COLOR",
          remote: false,
        },
      ]),
    ),
    styles: Object.fromEntries(styles.map((id) => [id, style(id, id)])),
  };
}

describe("usedTokens", () => {
  it("keeps what the layer uses and every variable its aliases reach, with their collections and every mode", () => {
    const kept = usedTokens(RAW, snapshotUsing(["brand"], ["S:card"]));

    expect(kept.variables.map(({ id }) => id)).toEqual(["brand", "blue-600", "blue-400"]);
    expect(kept.collections.map(({ id, modes }) => [id, modes.length])).toEqual([
      ["theme", 2],
      ["palette", 1],
    ]);
    expect(Object.keys(kept.external)).toEqual(["lib-blue"]);
    expect(kept.styles.map(({ id }) => id)).toEqual(["S:card"]);
    expect(kept.colorProfile).toBe("SRGB");
    expect(kept).not.toHaveProperty("library");
    expect(kept).not.toHaveProperty("libraryError");
  });

  it("keeps a library variable the layer uses directly, and nothing for an id the file does not know", () => {
    const kept = usedTokens(RAW, snapshotUsing(["lib-red", "ghost"], []));

    expect(kept.variables).toEqual([]);
    expect(Object.keys(kept.external)).toEqual(["lib-red"]);
  });
});

describe("withLiveNames", () => {
  it("gives the baseline the live names of the tokens both use, by id, and leaves the others as they were", () => {
    const before = snapshotUsing(["brand", "gone"], ["S:card"]);
    const after: Snapshot = {
      ...snapshotUsing(["brand"], ["S:card"]),
      variables: {
        brand: {
          name: "color/brand",
          collection: "theme",
          resolvedType: "COLOR",
          remote: false,
          codeSyntax: { WEB: "--brand" },
        },
      },
      styles: {
        "S:card": {
          ...style("S:card", "Surface/Card"),
          duplicate: 2,
        },
      },
    };
    const renamed = withLiveNames(before, after);

    expect(renamed.variables.brand).toMatchObject({
      name: "color/brand",
      codeSyntax: { WEB: "--brand" },
    });
    expect(renamed.variables.gone?.name).toBe("gone");
    expect(renamed.styles["S:card"]).toMatchObject({
      name: "Surface/Card",
      duplicate: 2,
    });
  });
});

describe("baselineFileOf", () => {
  const file = {
    pixelwrightBaseline: 1,
    name: "pricing",
    capturedAt: "2026-10-14T09:12:04.512Z",
    by: {
      server: "0.3.0",
      plugin: "0.3.0",
    },
    file: {
      name: "Test MCP",
      key: null,
    },
    page: null,
    node: {
      id: "1:1",
      name: "Pricing",
      type: "FRAME",
    },
    code: ["src/pricing.tsx"],
    version: null,
    snapshot: snapshotUsing([], []),
    tokens: null,
  };

  it("reads a baseline of this format, and refuses one a newer Pixelwright wrote", () => {
    expect(baselineFileOf(file).name).toBe("pricing");
    expect(() =>
      baselineFileOf({
        ...file,
        pixelwrightBaseline: 2,
      }),
    ).toThrow("saved by a newer Pixelwright: update it");
  });
});
