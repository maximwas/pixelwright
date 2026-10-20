import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { applyTokens } from "../../server/src/features/tokens-apply/apply-tokens.ts";
import { TokensApplyToolInputSchema } from "../../server/src/features/tokens-apply/schemas.ts";
import { readTokens } from "../../server/src/features/tokens-read/read-tokens.ts";
import { TokensReadInputSchema } from "../../server/src/features/tokens-read/schemas.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { textNode } from "./helpers/apply-document.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge, pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** A design system's shadow colour: a variable with alpha. */
const SHADOW = {
  r: 0.08,
  g: 0.09,
  b: 0.12,
  a: 0.16,
};

let page: FakeNode;

const byId = (id: string): FakeNode => {
  const find = (at: FakeNode): FakeNode | undefined =>
    at.id === id ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

  return find(page) as FakeNode;
};

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        layoutMode: "VERTICAL",
        width: 200,
        height: 120,
        children: [textNode("1:2", "Hello")],
      },
    ],
  });
  installFigma(page, {
    fonts: [
      {
        family: "Inter",
        style: "Regular",
      },
    ],
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
    localVariables: [
      {
        id: "V:shadow",
        name: "shadow/soft",
        variableCollectionId: "C:1",
        resolvedType: "COLOR",
        remote: false,
        scopes: ["ALL_SCOPES"],
        codeSyntax: {},
        valuesByMode: { "M:1": SHADOW },
      },
    ],
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const client = () => new PluginClient(pluginBridge(plugin));

const apply = (xml: string, dryRun = false) =>
  applyDesign(client(), {
    xml,
    dryRun,
  });

const read = async (id: string) => {
  const result = await readDesign(client(), {
    node: id,
    screenshot: false,
    maxChars: 80_000,
    code: false,
  });

  return (result.content[0] as { text: string }).text;
};

const boundTo = (id: string) =>
  (byId(id).effects as DropShadowEffect[]).map((effect) => effect.boundVariables?.color?.id);

describe("design_apply: a shadow's colour from a colour variable", () => {
  it("binds the colour of a shadow, an inner shadow and a text's shadow, in the variable's colour", async () => {
    await expect(
      apply(
        '<Frame id="1:1" box-shadow="0 4px 12px 0 var(--shadow-soft), inset 0 1px 0 0 #FFF"><Text id="1:2" text-shadow="0 2px 4px var(--shadow-soft)"/></Frame>',
      ),
    ).resolves.toMatchObject({ errors: [] });

    expect(boundTo("1:1")).toEqual([undefined, "V:shadow"]);
    expect(boundTo("1:2")).toEqual(["V:shadow"]);
    expect((byId("1:1").effects as DropShadowEffect[])[1]?.color).toEqual(SHADOW);
  });

  it("reads the bound colour back as var(), and the read sent back writes nothing", async () => {
    await apply('<Frame id="1:1" box-shadow="inset 0 4px 12px 0 var(--shadow-soft)"/>');

    const xml = await read("1:1");

    expect(xml).toContain('box-shadow="inset 0 4px 12px 0 var(--shadow-soft)"');
    await expect(apply(xml)).resolves.toMatchObject({
      changed: [],
      errors: [],
    });
  });

  it("names a near variable when none has the name, in a dry run too", async () => {
    for (const dryRun of [false, true]) {
      const { errors } = await apply('<Frame id="1:1" box-shadow="0 4px 12px 0 var(--shadow-sof)"/>', dryRun);

      expect(errors).toEqual([
        expect.objectContaining({
          attribute: "box-shadow",
          message: expect.stringMatching(/No .* is named --shadow-sof /),
          hint: expect.stringMatching(/--shadow-soft/),
        }),
      ]);
    }
  });
});

describe("tokens_apply: an effect style's shadow colour from a colour variable", () => {
  it("binds it, tokens_read writes it as var(), and that sent back writes nothing", async () => {
    const tokens = pluginClient(plugin);
    const lift = TokensApplyToolInputSchema.parse({
      styles: {
        effect: [
          {
            name: "Lift",
            value: "0 4px 12px 0 var(--shadow-soft)",
          },
        ],
      },
    });

    await expect(applyTokens(tokens, lift)).resolves.toMatchObject({
      created: [{ name: "Lift" }],
      errors: [],
    });

    const [style] = await figma.getLocalEffectStylesAsync();

    expect(style?.effects[0]).toMatchObject({
      color: SHADOW,
      boundVariables: { color: { id: "V:shadow" } },
    });

    const back = await readTokens(tokens, TokensReadInputSchema.parse({ format: "json" }));

    expect(back.tokens?.styles.effect).toEqual([expect.objectContaining({ value: "0 4px 12px 0 var(--shadow-soft)" })]);
    await expect(applyTokens(tokens, TokensApplyToolInputSchema.parse({ ...back.tokens }))).resolves.toMatchObject({
      created: [],
      updated: [],
      errors: [],
    });
  });

  it("names a near variable when none has the name, in a dry run too", async () => {
    for (const dryRun of [false, true]) {
      const applied = await applyTokens(
        pluginClient(plugin),
        TokensApplyToolInputSchema.parse({
          dryRun,
          styles: {
            effect: [
              {
                name: "Lift",
                value: "0 4px 12px 0 var(--shadow-sof)",
              },
            ],
          },
        }),
      );

      expect(applied.errors).toEqual([
        expect.objectContaining({
          name: "Lift",
          message: expect.stringMatching(/--shadow-sof .*--shadow-soft/),
        }),
      ]);
    }
  });
});
