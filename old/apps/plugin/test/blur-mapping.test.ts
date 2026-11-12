import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { applyTokens } from "../../server/src/features/tokens-apply/apply-tokens.ts";
import { TokensApplyToolInputSchema } from "../../server/src/features/tokens-apply/schemas.ts";
import { readTokens } from "../../server/src/features/tokens-read/read-tokens.ts";
import { TokensReadInputSchema } from "../../server/src/features/tokens-read/schemas.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

/** Figma renders a blur of radius R as CSS blur(0.43 R) does: radius 20 is blur(8.6px). */
const blur = (type: string) => ({
  type,
  visible: true,
  radius: 20,
  blurType: "NORMAL",
});

const SHADOW = {
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
};

const box = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  name: id,
  absoluteBoundingBox: {
    x: 0,
    y: 0,
    width: 200,
    height: 120,
  },
  ...fields,
});

let page: FakeNode;
const byId = (id: string) => (page.children ?? []).find((node) => node.id === id);

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      box("1:1", { effects: [blur("LAYER_BLUR")] }),
      box("1:2", { effects: [blur("BACKGROUND_BLUR")] }),
      box("1:3"),
    ],
  });
  installFigma(page, {
    localStyles: {
      effect: [
        {
          id: "S:glass",
          type: "EFFECT",
          name: "Glass",
          remote: false,
          effects: [blur("BACKGROUND_BLUR"), SHADOW],
        },
      ],
    },
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const client = () => pluginClient(plugin);

const read = async (node: string) => {
  const result = await readDesign(client(), {
    node,
    screenshot: false,
    maxChars: 80_000,
    code: false,
  });

  return (result.content[0] as { text: string }).text;
};

const apply = (xml: string) =>
  applyDesign(client(), {
    xml,
    dryRun: false,
  });

const NOTHING = {
  created: [],
  updated: [],
  errors: [],
  dryRun: false,
};

describe("blur mapping, design_read and design_apply", () => {
  it("reads a layer blur and a background blur of radius 20 as blur(8.6px), and the reads sent back write nothing", async () => {
    const layer = await read("1:1");
    const backdrop = await read("1:2");

    expect(layer).toContain('filter="blur(8.6px)"');
    expect(backdrop).toContain('backdrop-filter="blur(8.6px)"');

    for (const xml of [layer, backdrop]) {
      await expect(apply(xml)).resolves.toMatchObject({
        changed: [],
        errors: [],
      });
    }
  });

  it("writes blur(8.6px) as radius 20", async () => {
    await expect(apply('<Frame id="1:3" filter="blur(8.6px)" backdrop-filter="blur(8.6px)"/>')).resolves.toMatchObject({
      changed: ["1:3"],
      errors: [],
    });
    expect(byId("1:3")?.effects).toMatchObject([
      {
        type: "LAYER_BLUR",
        radius: 20,
      },
      {
        type: "BACKGROUND_BLUR",
        radius: 20,
      },
    ]);
  });
});

describe("blur mapping, effect styles", () => {
  it("writes nothing when tokens_read's styles are sent back to tokens_apply", async () => {
    const read = await readTokens(client(), TokensReadInputSchema.parse({ format: "json" }));

    await expect(applyTokens(client(), TokensApplyToolInputSchema.parse({ ...read.tokens }))).resolves.toEqual(NOTHING);
  });

  it("writes nothing when a style's blur is given as design_read writes it", async () => {
    const styles = {
      effect: [
        {
          name: "Glass",
          value: "0 4px 12px 0 rgba(0, 0, 0, 0.25); backdrop-filter: blur(8.6px)",
        },
      ],
    };

    await expect(applyTokens(client(), TokensApplyToolInputSchema.parse({ styles }))).resolves.toEqual(NOTHING);
  });
});
