import { beforeEach, describe, expect, it } from "vitest";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const OFFLINE = "Unable to establish connection to Figma after 10 seconds. Please check your internet connection.";

beforeEach(() => {
  installFigma(
    tree({
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
      ],
    }),
    {
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
    },
  );

  // Offline, Figma gives up on any lookup by id after ten seconds, even of the file's own variables.
  const variables = (globalThis as unknown as { figma: { variables: Record<string, unknown> } }).figma.variables;

  variables.getVariableByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
  variables.getVariableCollectionByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
  (globalThis as unknown as { figma: Record<string, unknown> }).figma.getStyleByIdAsync = async () => {
    throw new Error(OFFLINE);
  };
});

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
