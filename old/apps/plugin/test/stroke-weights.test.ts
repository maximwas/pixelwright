import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginClient } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

let page: FakeNode;

const card = () => (page.children ?? [])[0] as FakeNode;

/** A card drawn with a 2.5 px border, the weight a designer gives a hairline at 2x. */
beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Card",
        absoluteBoundingBox: {
          x: 0,
          y: 0,
          width: 200,
          height: 120,
        },
        strokes: [
          {
            type: "SOLID",
            visible: true,
            color: {
              r: 0,
              g: 0,
              b: 0,
            },
          },
        ],
        strokeWeight: 2.5,
        strokeAlign: "INSIDE",
      },
    ],
  });
  installFigma(page);
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const read = async () => {
  const result = await readDesign(pluginClient(plugin), {
    node: "1:1",
    screenshot: false,
    maxChars: 80_000,
    code: false,
  });

  return (result.content[0] as { text: string }).text;
};

const apply = (xml: string) =>
  applyDesign(pluginClient(plugin), {
    xml,
    dryRun: false,
  });

describe("a stroke weight with a fraction", () => {
  it("reads as 2.5px, and the read sent back writes nothing", async () => {
    const xml = await read();

    expect(xml).toContain('border="2.5px solid #000"');
    await expect(apply(xml)).resolves.toMatchObject({
      changed: [],
      errors: [],
    });
    expect(card().strokeWeight).toBe(2.5);
  });

  it("changes to a whole 3px when that is sent", async () => {
    await expect(apply('<Frame id="1:1" border="3px solid #000"/>')).resolves.toMatchObject({
      changed: ["1:1"],
      errors: [],
    });
    expect(card().strokeWeight).toBe(3);
  });
});
