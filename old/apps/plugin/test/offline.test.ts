import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { applyTokens } from "../../server/src/features/tokens-apply/apply-tokens.ts";
import { TokensApplyToolInputSchema } from "../../server/src/features/tokens-apply/schemas.ts";
import { bindTokens } from "../../server/src/features/tokens-bind/bind-tokens.ts";
import { TokensBindInputSchema } from "../../server/src/features/tokens-bind/schemas.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const OFFLINE = "Unable to establish connection to Figma after 10 seconds. Please check your internet connection.";

let page: FakeNode;

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        effectStyleId: "S:shadow",
        effects: [
          {
            type: "DROP_SHADOW",
            visible: true,
            color: {
              r: 0,
              g: 0,
              b: 0,
              a: 0.2,
            },
            offset: {
              x: 0,
              y: 4,
            },
            radius: 12,
            spread: 0,
          },
        ],
        fills: [
          {
            type: "SOLID",
            visible: true,
            color: {
              r: 1,
              g: 1,
              b: 1,
            },
            boundVariables: {
              color: {
                type: "VARIABLE_ALIAS",
                id: "V:surface",
              },
            },
          },
        ],
      },
      {
        id: "1:2",
        name: "Tile",
        type: "RECTANGLE",
        fillStyleId: "",
        strokeStyleId: "",
        fills: [
          {
            type: "SOLID",
            visible: true,
            opacity: 1,
            color: {
              r: 1,
              g: 1,
              b: 1,
            },
          },
        ],
      },
    ],
  });
  installFigma(page, {
    localCollections: [
      {
        id: "C:1",
        name: "Theme",
        remote: false,
        defaultModeId: "M:1",
        modes: [
          {
            modeId: "M:1",
            name: "Light",
          },
        ],
      },
    ],
    localStyles: {
      effect: [
        {
          id: "S:shadow",
          type: "EFFECT",
          name: "Card shadow",
          remote: false,
          effects: [
            {
              type: "DROP_SHADOW",
              visible: true,
              color: {
                r: 0,
                g: 0,
                b: 0,
                a: 0.2,
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
    localVariables: [
      {
        id: "V:surface",
        name: "surface",
        variableCollectionId: "C:1",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        codeSyntax: {},
        remote: false,
        valuesByMode: {
          "M:1": {
            r: 1,
            g: 1,
            b: 1,
            a: 1,
          },
        },
        resolveForConsumer: () => ({
          value: {
            r: 1,
            g: 1,
            b: 1,
            a: 1,
          },
        }),
      },
    ],
  });

  // Offline, Figma gives up on any lookup by id after ten seconds, even of the file's own variables.
  const variables = (globalThis as unknown as { figma: { variables: Record<string, unknown> } }).figma.variables;

  variables.getVariableByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
  variables.getVariableCollectionByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
  variables.createVariableAliasByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
  (globalThis as unknown as { figma: Record<string, unknown> }).figma.getStyleByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const client = () => new PluginClient(pluginBridge(plugin));
const tile = () => (page.children ?? []).find(({ id }) => id === "1:2") as FakeNode;

describe("design_read with Figma offline", () => {
  it("still reads the file's own variables and styles, from the lists Figma gives offline", async () => {
    const result = await readDesign(new PluginClient(pluginBridge(plugin)), {
      node: "1:1",
      screenshot: false,
      maxChars: 80_000,
      code: false,
    });
    const xml = (result.content[0] as { text: string }).text;

    expect(xml).toContain('background="var(--surface)"');
    expect(xml).toContain('box-shadow="var(--Card-shadow)"');
  });
});

describe("writes with Figma offline", () => {
  it("binds a token to a paint with design_apply, the file's own variable found in its list", async () => {
    await expect(
      applyDesign(client(), {
        xml: '<Rectangle id="1:2" background="var(--surface)"/>',
        dryRun: false,
      }),
    ).resolves.toMatchObject({ errors: [] });
    expect((tile().fills as SolidPaint[])[0]?.boundVariables?.color?.id).toBe("V:surface");
  });

  it("writes a held variable and an alias to it with tokens_apply", async () => {
    await expect(
      applyTokens(
        client(),
        TokensApplyToolInputSchema.parse({
          collections: [
            {
              name: "Theme",
              variables: [
                {
                  name: "surface",
                  values: { Light: "#EEE" },
                },
                {
                  name: "card",
                  values: { Light: "var(--surface)" },
                },
              ],
            },
          ],
        }),
      ),
    ).resolves.toMatchObject({ errors: [] });

    const variables = await figma.variables.getLocalVariablesAsync();

    expect(variables.find(({ name }) => name === "card")?.valuesByMode).toEqual({
      "M:1": {
        type: "VARIABLE_ALIAS",
        id: "V:surface",
      },
    });
  });

  it("binds a raw colour to the variable holding it with tokens_bind", async () => {
    const result = await bindTokens(client(), TokensBindInputSchema.parse({ within: "1:2" }));

    expect(result.errors).toEqual([]);
    expect((tile().fills as SolidPaint[])[0]?.boundVariables?.color?.id).toBe("V:surface");
  });

  it("finds a variable with execute's pw.variable", async () => {
    expect(
      await plugin.run("execute", {
        code: 'return (await pw.variable("--surface")).id;',
        timeoutMs: 1_000,
      }),
    ).toMatchObject({ result: "V:surface" });
  });
});
