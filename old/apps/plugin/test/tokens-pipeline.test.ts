import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyTokens } from "../../server/src/features/tokens-apply/apply-tokens.ts";
import { TokensApplyToolInputSchema } from "../../server/src/features/tokens-apply/schemas.ts";
import { readTokens } from "../../server/src/features/tokens-read/read-tokens.ts";
import { TokensReadInputSchema } from "../../server/src/features/tokens-read/schemas.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const BLACK = {
  r: 0,
  g: 0,
  b: 0,
  a: 1,
};

beforeEach(() => {
  installFigma(
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
          family: "Space Grotesk",
          style: "Medium",
        },
      ],
      localStyles: {
        paint: [
          {
            id: "S:veil",
            type: "PAINT",
            name: "Veil",
            remote: false,
            paints: [
              {
                type: "SOLID",
                visible: true,
                opacity: 0.4,
                blendMode: "NORMAL",
                color: {
                  r: 0.1,
                  g: 0.1,
                  b: 0.14,
                },
              },
            ],
          },
        ],
        text: [
          {
            id: "S:h2",
            type: "TEXT",
            name: "Heading/h2",
            remote: false,
            fontName: {
              family: "Space Grotesk",
              style: "Medium",
            },
            fontSize: 40,
            lineHeight: {
              unit: "PIXELS",
              value: 51,
            },
            letterSpacing: {
              unit: "PERCENT",
              value: 0,
            },
            textCase: "ORIGINAL",
            textDecoration: "NONE",
          },
        ],
        effect: [
          {
            id: "S:card",
            type: "EFFECT",
            name: "Card",
            remote: false,
            effects: [
              {
                type: "DROP_SHADOW",
                visible: true,
                blendMode: "NORMAL",
                color: {
                  r: 0.098,
                  g: 0.102,
                  b: 0.137,
                  a: 1,
                },
                offset: {
                  x: 0,
                  y: 5,
                },
                radius: 0,
                spread: 0,
              },
              {
                type: "INNER_SHADOW",
                visible: true,
                blendMode: "NORMAL",
                // Its colour bound to a variable, as Figma keeps one: the variable's colour.
                color: BLACK,
                boundVariables: {
                  color: {
                    type: "VARIABLE_ALIAS",
                    id: "V:ink",
                  },
                },
                offset: {
                  x: 0,
                  y: 0,
                },
                radius: 4,
                spread: 1,
              },
            ],
          },
        ],
      },
      localCollections: [
        {
          id: "C:brand",
          name: "Brand",
          remote: false,
          defaultModeId: "M:light",
          modes: [
            {
              modeId: "M:light",
              name: "Light",
            },
            {
              modeId: "M:dark",
              name: "Dark",
            },
          ],
        },
      ],
      localVariables: [
        {
          id: "V:surface",
          name: "Surface",
          variableCollectionId: "C:brand",
          resolvedType: "COLOR",
          description: "Page background",
          scopes: ["FRAME_FILL"],
          codeSyntax: { WEB: "var(--surface)" },
          valuesByMode: {
            "M:light": {
              r: 0.98,
              g: 0.97,
              b: 0.96,
              a: 1,
            },
            "M:dark": {
              type: "VARIABLE_ALIAS",
              id: "V:ink",
            },
          },
        },
        {
          id: "V:ink",
          name: "color/ink",
          variableCollectionId: "C:brand",
          resolvedType: "COLOR",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:light": BLACK,
            "M:dark": {
              r: 0.1,
              g: 0.1,
              b: 0.12,
              a: 0.8,
            },
          },
        },
        {
          id: "V:gap",
          name: "space/gap",
          variableCollectionId: "C:brand",
          resolvedType: "FLOAT",
          description: "",
          scopes: ["GAP"],
          valuesByMode: {
            "M:light": 12.5,
            "M:dark": 12.5,
          },
        },
        {
          id: "V:muted",
          name: "opacity/muted",
          variableCollectionId: "C:brand",
          resolvedType: "FLOAT",
          description: "",
          scopes: ["OPACITY"],
          valuesByMode: {
            "M:light": 0.6,
            "M:dark": 0.4,
          },
        },
        {
          id: "V:font",
          name: "font/body",
          variableCollectionId: "C:brand",
          resolvedType: "STRING",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:light": "Inter",
            "M:dark": "It's Inter",
          },
        },
        {
          id: "V:flag",
          name: "flag",
          variableCollectionId: "C:brand",
          resolvedType: "BOOLEAN",
          description: "",
          scopes: ["ALL_SCOPES"],
          valuesByMode: {
            "M:light": true,
            "M:dark": false,
          },
        },
      ],
    },
  );
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

describe("tokens_apply end to end", () => {
  it("writes nothing when given what tokens_read returned, variables and styles", async () => {
    const client = pluginClient(plugin);
    const read = await readTokens(client, TokensReadInputSchema.parse({ format: "json" }));
    const applied = await applyTokens(client, TokensApplyToolInputSchema.parse({ ...read.tokens }));

    expect(read.tokens?.styles).toMatchObject({
      paint: [{ name: "Veil" }],
      text: [{ name: "Heading/h2" }],
      effect: [
        {
          name: "Card",
          value: "inset 0 0 4px 1px var(--color-ink), 0 5px 0 0 #191A23",
        },
      ],
    });

    expect(applied).toEqual({
      created: [],
      updated: [],
      errors: [],
      dryRun: false,
    });
  });

  it("copies scopes and code syntax into another file, and the copy fed back writes nothing", async () => {
    const client = pluginClient(plugin);
    const read = await readTokens(client, TokensReadInputSchema.parse({ format: "json" }));

    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [],
      }),
    );

    const input = TokensApplyToolInputSchema.parse({ collections: read.tokens?.collections });

    await expect(applyTokens(client, input)).resolves.toMatchObject({ errors: [] });

    const variables = await figma.variables.getLocalVariablesAsync();
    const named = (name: string) => variables.find((variable) => variable.name === name);

    expect(named("Surface")).toMatchObject({
      scopes: ["FRAME_FILL"],
      codeSyntax: { WEB: "var(--surface)" },
    });
    expect(named("space/gap")?.scopes).toEqual(["GAP"]);
    // Figma keeps an opacity variable's numbers as percents: the copy's 0.6 reads back as it was.
    expect(Object.values(named("opacity/muted")?.valuesByMode ?? {})).toEqual([60, 40]);
    await expect(applyTokens(client, input)).resolves.toEqual({
      created: [],
      updated: [],
      errors: [],
      dryRun: false,
    });
  });

  it("returns the values it could not read with the plugin's errors, and writes the rest", async () => {
    const applied = await applyTokens(
      pluginClient(plugin),
      TokensApplyToolInputSchema.parse({
        collections: [
          {
            name: "Brand",
            variables: [
              {
                name: "color/ink",
                values: { Light: "not a colour" },
              },
              {
                name: "space/gap",
                values: { Light: "16px" },
              },
              {
                name: "flag",
                values: { Light: "16px" },
              },
            ],
          },
        ],
      }),
    );

    expect(applied.errors.map(({ name }) => name)).toEqual(["color/ink", "flag"]);
    expect(applied.updated).toEqual([
      {
        kind: "variable",
        collection: "Brand",
        name: "space/gap",
      },
    ]);
  });
});
