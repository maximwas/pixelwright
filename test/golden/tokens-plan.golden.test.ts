import { describe, expect, it } from "vitest";
import { type RawTokens, RawTokensSchema } from "@/shared/ops/variables/variables.schema.ts";
import { goldenTokens } from "./fixtures/tokens-input.ts";
import { EMPTY, plan, readJson } from "./support/tokens-planner.ts";

const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const NOTHING = {
  plan: { collections: [], styles: { paint: [], text: [], effect: [] } },
  created: [],
  updated: [],
  errors: [],
  notes: [],
};

/** Edits of the golden file, sent as a client sends them: only what changes. */
const CHANGED = {
  collections: [
    {
      name: "Brand Colors",
      variables: [
        // A mode the collection lacks is made, after the ones it has.
        { name: "Surface/Base", values: { "High contrast": "#000" }, description: "The page, behind everything." },
        // The same colour written otherwise is held already.
        { name: "Ink", values: { Light: "#14161f" } },
      ],
    },
    {
      name: "Spacing",
      variables: [
        // A renamed variable is a new one: the old one stays, nothing is deleted.
        { name: "Gap/Medium", values: { Base: "12px" }, scopes: ["GAP"] },
        { name: "Radius", values: { Base: "16px" } },
        // An opacity is written as Figma keeps it: in percent.
        { name: "Opacity/Half", values: { Base: "0.6" } },
        // A plain number with no scope reads back in px: a note.
        { name: "Line/Height", values: { Base: "1.5" } },
        { name: "Weight/Bold", values: { Base: "700" }, scopes: ["FONT_WEIGHT", "TEXT_CONTENT", "FONT_WEIGHT"] },
      ],
    },
    {
      name: "Brand 2",
      variables: [
        { name: "Surface/Alias", values: { Night: "var(--Ink)", Day: "var(--surface)" } },
        { name: "Alpha", values: { Day: "0.4", Dusk: "40" }, scopes: ["OPACITY"] },
      ],
    },
  ],
  styles: {
    paint: [
      // Of two paint styles named White, the token says which: the file's own changes, the library's is held.
      { name: "White", token: "--White", value: "#F5F5F5" },
      { name: "White", token: "--White-2", value: "rgba(250, 250, 250, 0.8)" },
    ],
    text: [
      {
        name: "Heading/H1",
        value: "italic 700 48px/57.6px 'Inter'",
        also: [
          { token: "--Heading-H1-letter-spacing", value: "-0.01em" },
          { token: "--Heading-H1-text-transform", value: "uppercase" },
        ],
      },
      { name: "Caption", value: "500 12px/16px 'Inter'; letter-spacing: 0.04em; text-transform: uppercase" },
    ],
    effect: [{ name: "Frost", token: "--Frost-backdrop-filter", value: "blur(5.16px)" }],
  },
};

/** The golden file with a library collection and paint style the page uses, and a library it can import from. */
function withLibrary(): RawTokens {
  const raw = goldenTokens();

  return RawTokensSchema.parse({
    ...raw,
    collections: [
      ...raw.collections,
      {
        id: "C:kit",
        name: "Library Colors",
        remote: true,
        defaultModeId: "M:kit",
        modes: [{ modeId: "M:kit", name: "Value" }],
      },
    ],
    variables: [
      ...raw.variables,
      {
        id: "V:kit-brand",
        name: "Brand",
        collectionId: "C:kit",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: { "M:kit": { r: 0.2, g: 0.4, b: 1, a: 1 } },
      },
      {
        id: "V:kit-shade",
        name: "Shade",
        collectionId: "C:kit",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: { "M:kit": { r: 0, g: 0, b: 0, a: 1 } },
      },
    ],
    styles: [
      ...raw.styles,
      {
        id: "S:kit-blue",
        name: "Library Blue",
        type: "PAINT",
        remote: true,
        paints: [{ type: "SOLID", visible: true, opacity: 1, blendMode: "NORMAL", color: { r: 0, g: 0, b: 1 } }],
      },
    ],
    library: [
      {
        libraryName: "Kit",
        collection: "Kit Colors",
        key: "K:kit",
        variables: [{ name: "Primary", key: "K:primary", resolvedType: "COLOR" }],
      },
    ],
  });
}

/** What Figma would refuse and what tokens_apply cannot write, each the error of its variable, mode or style. */
const REFUSED = {
  collections: [
    {
      name: "Spacing",
      variables: [
        { name: "Radius", type: "color", values: { Base: "#FFF" } },
        { name: "Twice", token: "--twice-a", codeSyntax: { WEB: "--twice-b" }, values: { Base: "4px" } },
        { name: "Odd", values: { Base: "12em" } },
        { name: "Typed", type: "FLOAT", values: { Base: "#FFF" } },
        { name: "Ease/In", type: "EASING", values: { Base: "ease-in" } },
        { name: "Pointer", values: { Base: "var(--Nowhere)" } },
        { name: "Pointer/Chain", values: { Base: "var(--Pointer)" } },
        // A library variable the page does not use is no target: Figma gives the alias only what the file holds.
        { name: "Pointer/Kit", values: { Base: "var(--Primary)" } },
      ],
    },
    {
      name: "Brand Colors",
      variables: [
        { name: "Bad/Scope", values: { Light: "#FFF" }, scopes: ["GAP"] },
        { name: "Fills", values: { Light: "#FFF" }, scopes: ["ALL_FILLS", "FRAME_FILL"] },
      ],
    },
    {
      name: "Library Colors",
      variables: [
        { name: "Brand", values: { Value: "#3366FF" } },
        { name: "Shade", values: { Value: "#111" } },
      ],
    },
    { name: "Kit Colors", variables: [{ name: "Primary", values: { Value: "#000" } }] },
  ],
  styles: {
    paint: [
      { name: "Mixed", value: "#FFF; font: 400 16px 'Inter'" },
      { name: "Library Blue", value: "#00F" },
      { name: "Library Blue", value: "#0F0" },
    ],
    text: [{ name: "Broken", value: "#FFF" }],
  },
};

describe("golden tokens plan", () => {
  it.each([
    ["sRGB", undefined],
    ["Display P3", "DISPLAY_P3"],
  ])(
    "plans nothing for tokens_read's own JSON of a %s file, libraries' tokens and what it cannot write among it (D-25)",
    (_space, profile) => {
      const raw = goldenTokens(profile);

      expect(plan(readJson(raw), raw)).toEqual(NOTHING);
    },
  );

  it("plans every token of tokens_read's JSON for a file without tokens: modes in their order, opacities in percent", async () => {
    await expect(pretty(plan(readJson(goldenTokens()), EMPTY))).toMatchFileSnapshot("__golden__/tokens.new.plan.json");
  });

  it("plans only what an edit changes: a new mode, a renamed variable as a new one, values and styles that differ", async () => {
    await expect(pretty(plan(CHANGED))).toMatchFileSnapshot("__golden__/tokens.changed.plan.json");
  });

  it("refuses what Figma or a library would refuse, each as its own error, and plans the rest", async () => {
    await expect(pretty(plan(REFUSED, withLibrary()))).toMatchFileSnapshot("__golden__/tokens.refused.plan.json");
  });

  // FX-050, m:b0144d23: Figma throws on each of these, so a dry run refuses them before anything is written.
  it("refuses ALL_SCOPES with another scope", () => {
    const planned = plan({
      collections: [
        { name: "Spacing", variables: [{ name: "Gap/Small", values: { Base: "8px" }, scopes: ["ALL_SCOPES", "GAP"] }] },
      ],
    });

    expect(planned.errors).toEqual([
      {
        kind: "variable",
        name: "Gap/Small",
        collection: "Spacing",
        message: "ALL_SCOPES stands alone: it already offers the variable for every field.",
      },
    ]);
    expect(planned.updated).toEqual([]);
  });

  it("refuses [] as a BOOLEAN's scopes", () => {
    const planned = plan({
      collections: [{ name: "Spacing", variables: [{ name: "Feature/Off", values: { Base: "false" }, scopes: [] }] }],
    });

    expect(planned.errors).toEqual([
      {
        kind: "variable",
        name: "Feature/Off",
        collection: "Spacing",
        message: "A BOOLEAN variable is offered for every field: its scopes can only be ALL_SCOPES.",
      },
    ]);
    expect(planned.created).toEqual([]);
  });

  // FX-051: Figma refuses a variable name with any of . { } $.
  it("refuses a variable name with a dot in it", () => {
    const planned = plan({
      collections: [{ name: "Spacing", variables: [{ name: "Gap.Large", values: { Base: "24px" } }] }],
    });

    expect(planned.errors).toEqual([
      {
        kind: "variable",
        name: "Gap.Large",
        collection: "Spacing",
        message: "Gap.Large has a character Figma refuses in a variable name: no . { } or $.",
      },
    ]);
    expect(planned.created).toEqual([]);
  });
});
