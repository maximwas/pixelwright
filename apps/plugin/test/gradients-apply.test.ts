import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesign } from "../../server/src/features/design-apply/apply-design.ts";
import { readDesign } from "../../server/src/features/design-read/read-design.ts";
import { PluginClient } from "../../server/src/plugin/plugin-client.ts";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { pluginBridge } from "./helpers/plugin-bridge.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const MARK = "linear-gradient(135deg, #3B2FD9 14.64%, #8B5CF6 85.36%)";

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
        children: [
          {
            id: "1:2",
            name: "Mark",
            type: "RECTANGLE",
            width: 28,
            height: 28,
            fills: [],
          },
          {
            id: "1:3",
            name: "Glow",
            type: "ELLIPSE",
            width: 120,
            height: 80,
            fills: [],
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
    localVariables: [
      {
        id: "V:brand",
        name: "brand",
        variableCollectionId: "C:1",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        codeSyntax: {},
        valuesByMode: {
          "M:1": {
            r: 0.231,
            g: 0.184,
            b: 0.851,
            a: 1,
          },
        },
      },
    ],
  });
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const client = () => new PluginClient(pluginBridge(plugin));

const apply = (xml: string) =>
  applyDesign(client(), {
    xml,
    dryRun: false,
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

describe("design_apply: gradients, blend modes and masks", () => {
  it("paints a linear, radial or conic gradient that reads back as it was written", async () => {
    const radial = "radial-gradient(60px 40px at 50% 50%, #FFF 0%, rgba(255, 255, 255, 0) 100%)";

    await expect(
      apply(`<Rectangle id="1:2" background="${MARK}"/><Ellipse id="1:3" background="${radial}"/>`),
    ).resolves.toMatchObject({ errors: [] });

    expect(byId("1:2").fills).toMatchObject([{ type: "GRADIENT_LINEAR" }]);
    expect(await read("1:2")).toContain(`background="${MARK}"`);
    expect(await read("1:3")).toContain(`background="${radial}"`);
  });

  it("changes nothing when a gradient comes back as it was read", async () => {
    await apply(`<Rectangle id="1:2" background="${MARK}"/>`);

    await expect(apply(await read("1:1"))).resolves.toMatchObject({
      changed: [],
      errors: [],
    });
  });

  it("binds a stop's token to its colour variable", async () => {
    await apply('<Rectangle id="1:2" background="linear-gradient(90deg, var(--brand) 0%, #FFF 100%)"/>');

    expect((byId("1:2").fills as GradientPaint[])[0]?.gradientStops[0]?.boundVariables?.color?.id).toBe("V:brand");
  });

  it("sets a blend mode (a frame's normal is Figma's pass through) and makes a layer a mask", async () => {
    await expect(
      apply(
        '<Frame id="1:1" mix-blend-mode="normal"/><Rectangle id="1:2" mix-blend-mode="multiply"/><Ellipse id="1:3" mask="alpha"/>',
      ),
    ).resolves.toMatchObject({ errors: [] });

    expect(byId("1:1").blendMode).toBe("PASS_THROUGH");
    expect(byId("1:2").blendMode).toBe("MULTIPLY");
    expect(byId("1:3")).toMatchObject({
      isMask: true,
      maskType: "ALPHA",
    });
    expect(await read("1:2")).toContain('mix-blend-mode="multiply"');
  });
});
