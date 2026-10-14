import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTokens } from "../../server/src/features/tokens-apply/apply-tokens.ts";
import { TokensApplyToolInputSchema } from "../../server/src/features/tokens-apply/schemas.ts";
import { readTokens } from "../../server/src/features/tokens-read/read-tokens.ts";
import { TokensReadInputSchema } from "../../server/src/features/tokens-read/schemas.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const text = (id: string, name: string, family: string, style: string, fontSize: number, lineHeight: object) => ({
  id,
  type: "TEXT",
  name,
  remote: false,
  fontName: {
    family,
    style,
  },
  fontSize,
  lineHeight,
  letterSpacing: {
    unit: "PERCENT",
    value: 0,
  },
  textCase: "ORIGINAL",
  textDecoration: "NONE",
});

/** A file whose tokens hold what CSS cannot show: percents, fractions, a condensed face, a blur, a bound paint. */
function lossy() {
  return installFigma(
    tree({
      id: "0:1",
      type: "PAGE",
      children: [],
    }),
    {
      fonts: [
        {
          family: "Inter",
          style: "Regular",
        },
        {
          family: "Open Sans",
          style: "Bold",
        },
        {
          family: "Open Sans",
          style: "Condensed Bold",
        },
      ],
      localStyles: {
        paint: [
          {
            id: "S:brand",
            type: "PAINT",
            name: "Brand",
            remote: false,
            paints: [
              {
                type: "SOLID",
                visible: true,
                opacity: 1,
                blendMode: "NORMAL",
                color: {
                  r: 0,
                  g: 0.6,
                  b: 1,
                },
                boundVariables: {
                  color: {
                    type: "VARIABLE_ALIAS",
                    id: "V:primary",
                  },
                },
              },
            ],
          },
        ],
        text: [
          text("S:body", "Body", "Inter", "Regular", 16, {
            unit: "PERCENT",
            value: 150,
          }),
          text("S:small", "Small", "Inter", "Regular", 13.5, {
            unit: "PIXELS",
            value: 18.5,
          }),
          text("S:label", "Label", "Open Sans", "Condensed Bold", 14, { unit: "AUTO" }),
        ],
        effect: [
          {
            id: "S:glass",
            type: "EFFECT",
            name: "Glass",
            remote: false,
            effects: [
              {
                type: "BACKGROUND_BLUR",
                visible: true,
                radius: 20,
                blurType: "NORMAL",
              },
              {
                type: "DROP_SHADOW",
                visible: true,
                blendMode: "NORMAL",
                color: {
                  r: 0,
                  g: 0,
                  b: 0,
                  a: 0.25,
                },
                offset: {
                  x: 0,
                  y: 4,
                },
                radius: 12,
                spread: 0,
              },
            ],
          },
        ],
      },
      localCollections: [
        {
          id: "C:1",
          name: "Base",
          remote: false,
          defaultModeId: "M:1",
          modes: [
            {
              modeId: "M:1",
              name: "Value",
            },
          ],
        },
      ],
      localVariables: [
        {
          id: "V:primary",
          name: "primary",
          variableCollectionId: "C:1",
          resolvedType: "COLOR",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:1": {
              r: 0,
              g: 0.6,
              b: 1,
              a: 1,
            },
          },
        },
        {
          id: "V:veil",
          name: "veil",
          variableCollectionId: "C:1",
          resolvedType: "COLOR",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:1": {
              r: 0,
              g: 0,
              b: 0,
              a: 0.125,
            },
          },
        },
        {
          id: "V:op",
          name: "opacity/half",
          variableCollectionId: "C:1",
          resolvedType: "FLOAT",
          description: "",
          scopes: ["OPACITY"],
          valuesByMode: { "M:1": 50 },
        },
        {
          id: "V:ratio",
          name: "scale/ratio",
          variableCollectionId: "C:1",
          resolvedType: "FLOAT",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: { "M:1": 1.125 },
        },
        {
          id: "V:track",
          name: "tracking/tight",
          variableCollectionId: "C:1",
          resolvedType: "FLOAT",
          description: "",
          scopes: ["LETTER_SPACING"],
          valuesByMode: { "M:1": -0.025 },
        },
      ],
    },
  );
}

const variable = async (name: string) =>
  (await figma.variables.getLocalVariablesAsync()).find((item) => item.name === name);
const textStyle = async (name: string) => (await figma.getLocalTextStylesAsync()).find((item) => item.name === name);

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("tokens_apply: what CSS cannot show survives", () => {
  it("writes nothing when given tokens_read's own output, however lossy its CSS", async () => {
    lossy();
    plugin.services.edits.allow(true);

    const client = pluginClient(plugin);
    const read = await readTokens(client, TokensReadInputSchema.parse({ format: "json" }));

    expect(await applyTokens(client, TokensApplyToolInputSchema.parse({ ...read.tokens }))).toEqual({
      created: [],
      updated: [],
      errors: [],
      dryRun: false,
    });
    expect((await textStyle("Body"))?.lineHeight).toEqual({
      unit: "PERCENT",
      value: 150,
    });
    expect((await textStyle("Small"))?.fontSize).toBe(13.5);
    expect((await textStyle("Label"))?.fontName).toEqual({
      family: "Open Sans",
      style: "Condensed Bold",
    });
    expect((await figma.getLocalEffectStylesAsync())[0]?.effects.map(({ type }) => type)).toEqual([
      "BACKGROUND_BLUR",
      "DROP_SHADOW",
    ]);
    expect((await figma.getLocalPaintStylesAsync())[0]?.paints).toMatchObject([
      { boundVariables: { color: { id: "V:primary" } } },
    ]);
    expect(Object.values((await variable("opacity/half"))?.valuesByMode ?? {})).toEqual([50]);
    expect(Object.values((await variable("scale/ratio"))?.valuesByMode ?? {})).toEqual([1.125]);
    expect(Object.values((await variable("tracking/tight"))?.valuesByMode ?? {})).toEqual([-0.025]);
    expect(Object.values((await variable("veil"))?.valuesByMode ?? {})).toEqual([
      {
        r: 0,
        g: 0,
        b: 0,
        a: 0.125,
      },
    ]);
  });

  it("keeps a style's own face, its blur and an opacity's percent when one value of it changes", async () => {
    lossy();
    plugin.services.edits.allow(true);

    const result = await applyTokens(
      pluginClient(plugin),
      TokensApplyToolInputSchema.parse({
        collections: [
          {
            name: "Base",
            variables: [
              {
                name: "opacity/half",
                values: { Value: "0.6" },
              },
            ],
          },
        ],
        styles: {
          text: [
            {
              name: "Label",
              value: "700 16px/normal 'Open Sans'",
            },
          ],
          effect: [
            {
              name: "Glass",
              value: "0 8px 12px 0 rgba(0, 0, 0, 0.25)",
            },
          ],
        },
      }),
    );

    expect(result.errors).toEqual([]);
    expect((await textStyle("Label"))?.fontName).toEqual({
      family: "Open Sans",
      style: "Condensed Bold",
    });
    expect((await textStyle("Label"))?.fontSize).toBe(16);
    expect((await figma.getLocalEffectStylesAsync())[0]?.effects).toMatchObject([
      {
        type: "BACKGROUND_BLUR",
        radius: 20,
      },
      {
        type: "DROP_SHADOW",
        offset: {
          x: 0,
          y: 8,
        },
      },
    ]);
    expect(Object.values((await variable("opacity/half"))?.valuesByMode ?? {})).toEqual([60]);
  });
});

describe("tokens_apply: library tokens", () => {
  /** Page A uses a library's collection and paint style; page B uses nothing. */
  function onTwoPages(): { pageB: FakeNode } {
    const pageA = tree({
      id: "0:1",
      type: "PAGE",
      name: "A",
      children: [
        {
          id: "1:1",
          name: "Card",
          fills: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              blendMode: "NORMAL",
              color: {
                r: 0,
                g: 1,
                b: 0,
              },
              boundVariables: {
                color: {
                  type: "VARIABLE_ALIAS",
                  id: "L:green",
                },
              },
            },
          ],
          fillStyleId: "S:lib",
        },
      ],
    });
    const pageB = tree({
      id: "0:2",
      type: "PAGE",
      name: "B",
      children: [],
    });

    installFigma(pageA, {
      pages: [pageB],
      styles: {
        "S:lib": {
          id: "S:lib",
          type: "PAINT",
          name: "Brand",
          remote: true,
          paints: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              blendMode: "NORMAL",
              color: {
                r: 0,
                g: 0,
                b: 1,
              },
            },
          ],
        },
      },
      variables: {
        "L:green": {
          id: "L:green",
          name: "Green",
          variableCollectionId: "LC:lib",
          resolvedType: "COLOR",
          remote: true,
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "LM:1": {
              r: 0,
              g: 1,
              b: 0,
              a: 1,
            },
          },
        },
      },
      collections: {
        "LC:lib": {
          id: "LC:lib",
          name: "DS colors",
          remote: true,
          defaultModeId: "LM:1",
          modes: [
            {
              modeId: "LM:1",
              name: "Value",
            },
          ],
        },
      },
      teamLibrary: {
        collections: [
          {
            key: "LK:prim",
            libraryName: "DS",
            name: "Primitives",
          },
        ],
        variables: {
          "LK:prim": [
            {
              name: "blue/500",
              key: "VK:blue",
              resolvedType: "COLOR",
            },
          ],
        },
      },
      importable: {
        "VK:blue": {
          id: "L:blue",
          name: "blue/500",
          resolvedType: "COLOR",
          variableCollectionId: "LC:prim",
          remote: true,
          valuesByMode: {},
        },
      },
    });

    return { pageB };
  }

  it("never copies a library's collection or style into the file, whatever page is current", async () => {
    const { pageB } = onTwoPages();

    plugin.services.edits.allow(true);

    const client = pluginClient(plugin);
    const read = await readTokens(client, TokensReadInputSchema.parse({ format: "json" }));

    figma.currentPage = pageB as never;

    expect(await applyTokens(client, TokensApplyToolInputSchema.parse({ ...read.tokens }))).toMatchObject({
      created: [],
      updated: [],
      errors: [],
    });
    expect((await figma.variables.getLocalVariableCollectionsAsync()).map(({ name }) => name)).toEqual([]);
    expect((await figma.getLocalPaintStylesAsync()).map(({ name }) => name)).toEqual([]);
  });

  it("points an alias at an enabled library's variable the file does not use yet, importing it", async () => {
    onTwoPages();
    plugin.services.edits.allow(true);

    const result = await applyTokens(
      pluginClient(plugin),
      TokensApplyToolInputSchema.parse({
        collections: [
          {
            name: "Semantic",
            variables: [
              {
                name: "accent",
                type: "COLOR",
                values: { Value: "var(--blue-500)" },
              },
            ],
          },
        ],
      }),
    );

    expect(result.errors).toEqual([]);
    expect(Object.values((await variable("accent"))?.valuesByMode ?? {})).toEqual([
      {
        type: "VARIABLE_ALIAS",
        id: "L:blue",
      },
    ]);
  });

  it("checks a variable alias and a paint style that use a library's colour without importing it", async () => {
    onTwoPages();

    const importing = vi.spyOn(figma.variables, "importVariableByKeyAsync");
    const result = await applyTokens(
      pluginClient(plugin),
      TokensApplyToolInputSchema.parse({
        collections: [
          {
            name: "Semantic",
            variables: [
              {
                name: "accent",
                type: "COLOR",
                values: { Value: "var(--blue-500)" },
              },
            ],
          },
        ],
        styles: {
          paint: [
            {
              name: "Accent",
              value: "var(--blue-500)",
            },
          ],
        },
        dryRun: true,
      }),
    );

    expect(result.errors).toEqual([]);
    expect(result.created).toContainEqual({
      kind: "paint",
      name: "Accent",
    });
    expect(importing).not.toHaveBeenCalled();
    expect(await figma.getLocalPaintStylesAsync()).toEqual([]);
  });

  it("names a paint style's token that is nowhere, on a dry run", async () => {
    onTwoPages();

    const result = await applyTokens(
      pluginClient(plugin),
      TokensApplyToolInputSchema.parse({
        styles: {
          paint: [
            {
              name: "Lost",
              value: "var(--nowhere)",
            },
          ],
        },
        dryRun: true,
      }),
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        kind: "paint",
        name: "Lost",
        message: expect.stringMatching(/No paint style or colour variable is named --nowhere/),
      }),
    ]);
  });
});

describe("tokens_apply: Figma refusing one item", () => {
  it("names the refused variable and writes the rest in one undo step", async () => {
    const fake = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [],
      }),
    );

    plugin.services.edits.allow(true);

    const result = await applyTokens(
      pluginClient(plugin),
      TokensApplyToolInputSchema.parse({
        collections: [
          {
            name: "Space",
            variables: [
              {
                name: "space/1",
                values: { Value: "4px" },
              },
              {
                name: "space/0.5",
                values: { Value: "2px" },
              },
              {
                name: "space/2",
                values: { Value: "8px" },
              },
            ],
          },
        ],
      }),
    );

    expect(result.errors).toEqual([
      expect.objectContaining({
        kind: "variable",
        name: "space/0.5",
      }),
    ]);
    expect(result.created.map(({ name }) => name)).toEqual(["Space", "Value", "space/1", "space/2"]);
    expect(fake.writes.undo).toBe(1);
  });
});
