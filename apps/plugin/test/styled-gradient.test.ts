import { describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/design/apply-design.ts";
import { readDesign } from "../../server/src/design/read-design.ts";
import { setEditsAllowed } from "../src/figma/edits.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";

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
    setEditsAllowed(true);

    const bridge = pluginBridge();
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
      applyDesign(bridge, {
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
