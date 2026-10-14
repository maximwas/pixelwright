import { describe, expect, it } from "vitest";
import { readDesign } from "../../server/src/design/read-design.ts";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const GRADIENT = {
  type: "GRADIENT_LINEAR",
  visible: true,
  opacity: 1,
  gradientStops: [
    {
      position: 0,
      color: {
        r: 1,
        g: 0,
        b: 0,
        a: 1,
      },
    },
    {
      position: 1,
      color: {
        r: 0,
        g: 0,
        b: 1,
        a: 1,
      },
    },
  ],
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};

describe("a layer filled with a gradient paint style", () => {
  it("reads with the style's value, and its read sent back writes nothing", async () => {
    installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        children: [
          {
            id: "1:1",
            type: "FRAME",
            name: "Card",
            layoutMode: "VERTICAL",
            children: [
              {
                id: "1:2",
                type: "RECTANGLE",
                name: "Buy",
                fills: [GRADIENT],
                fillStyleId: "S:g",
                css: { background: "linear-gradient(90deg, #F00 0%, #00F 100%)" },
              },
            ],
          },
        ],
      }),
      {
        styles: {
          "S:g": {
            id: "S:g",
            name: "Brand Gradient",
            type: "PAINT",
            remote: true,
            paints: [GRADIENT],
          },
        },
      },
    );
    plugin.services.edits.allow(true);

    const bridge = pluginBridge(plugin);
    const read = await readDesign(bridge, {
      node: "1:1",
      screenshot: false,
      maxChars: 80_000,
      code: false,
    });
    const xml = (read.content[0] as { text: string }).text;
    const meta = JSON.parse((read.content[1] as { text: string }).text) as { tokens: Record<string, string> };

    expect(xml).toContain('background="var(--Brand-Gradient)"');
    expect(meta.tokens["--Brand-Gradient"]).toBe("linear-gradient(90deg, #F00 0%, #00F 100%)");
    await expect(
      applyDesign(new PluginClient(bridge), {
        xml,
        dryRun: false,
      }),
    ).resolves.toMatchObject({
      created: [],
      changed: [],
      errors: [],
    });
  });
});
