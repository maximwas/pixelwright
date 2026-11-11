import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install, planStarter, planPro } = TEST_MCP.ids;

const PREFIX = "live:inspect:";

/** The ring's radius, and how many labels sit on it, one every 45 degrees. */
const RING = { radius: 150, labels: 8 } as const;

type Inspected = {
  around?: { x: number; y: number };
  left?: number;
  layers: {
    id: string;
    distance?: number;
    angle?: number;
    blendMode?: string;
    mixBlendMode?: string;
    fills?: { paints: { type: string; blendMode?: string; mixBlendMode?: string }[] };
    bound?: Record<string, { token: string; value?: unknown }>;
  }[];
};

// Writes in the Live tests Section (layers named live:inspect:<case>, removed after), reads with inspect and measure.
describe("read/inspect", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const inspect = async (args: ToolResult): Promise<Inspected> =>
    (await client.call("inspect", { file, ...args })) as Inspected;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}
figma.currentPage.selection = [];`);
    await client.close();
  });

  // T-080, O-026: the card's padding, gap and radius tokens are the var() names design_read writes.
  it("reads the Install card's padding, gap and radius tokens, each as design_read writes it", async () => {
    const [card] = (await inspect({ nodes: [install] })).layers;
    const bound = card?.bound ?? {};
    const [xml] = await client.texts("design_read", { file, node: install });

    expect(Object.keys(bound)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^padding/), "itemSpacing", expect.stringMatching(/Radius$/)]),
    );

    for (const { token } of Object.values(bound)) {
      expect(xml).toContain(`var(${token})`);
    }
  });

  // T-082, m:07ad610a: 8 labels on a ring, every other one turned, read around the hub.
  it("gives a ring's labels angles 0 to 315 at equal distances from its hub", async () => {
    const made = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const hub = figma.createEllipse();
hub.name = ${JSON.stringify(`${PREFIX}hub`)};
hub.resize(20, 20);
section.appendChild(hub);
hub.x = 400;
hub.y = 400;
const centre = { x: hub.absoluteBoundingBox.x + 10, y: hub.absoluteBoundingBox.y + 10 };
const labels = [];
for (let index = 0; index < ${RING.labels}; index += 1) {
  const turn = (index * 2 * Math.PI) / ${RING.labels};
  const label = figma.createRectangle();
  label.name = ${JSON.stringify(`${PREFIX}ring`)} + index;
  label.resize(40, 16);
  section.appendChild(label);
  if (index % 2 === 1) label.rotation = 30;
  const box = label.absoluteBoundingBox;
  label.x += centre.x + ${RING.radius} * Math.sin(turn) - (box.x + box.width / 2);
  label.y += centre.y - ${RING.radius} * Math.cos(turn) - (box.y + box.height / 2);
  labels.push(label.id);
}
return { hub: hub.id, labels };`)) as { hub: string; labels: string[] };
    const { layers } = await inspect({ nodes: made.labels, around: made.hub });

    expect(layers.map(({ angle }) => Math.round(angle ?? -1))).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);

    for (const { distance } of layers) {
      expect(distance).toBeCloseTo(RING.radius, 1);
    }
  });

  // B-002: the layer's blend mode with its CSS name, and each fill's.
  it("gives a soft-light ellipse with a layer blur its blend mode, and its multiply fill's", async () => {
    const id = await run(`const section = await pw.node(${JSON.stringify(scratch)});
const ellipse = figma.createEllipse();
ellipse.name = ${JSON.stringify(`${PREFIX}soft-light`)};
ellipse.resize(120, 120);
ellipse.blendMode = "SOFT_LIGHT";
ellipse.effects = [{ type: "LAYER_BLUR", blurType: "NORMAL", radius: 20, visible: true }];
ellipse.fills = [{ type: "SOLID", color: { r: 1, g: 0.4, b: 0 }, blendMode: "MULTIPLY" }];
section.appendChild(ellipse);
return ellipse.id;`);
    const [ellipse] = (await inspect({ nodes: [id] })).layers;

    expect(ellipse).toMatchObject({ blendMode: "SOFT_LIGHT", mixBlendMode: "soft-light" });
    expect(ellipse?.fills?.paints).toEqual([{ type: "SOLID", blendMode: "MULTIPLY", mixBlendMode: "multiply" }]);
  });

  // O-014: a selection past 100 layers is cut at 100, and the answer says how many it left.
  it("inspects the first 100 of 101 selected layers and says it left 1", async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
const dots = [];
for (let index = 0; index < 101; index += 1) {
  const dot = figma.createRectangle();
  dot.name = ${JSON.stringify(`${PREFIX}dot`)} + index;
  dot.resize(4, 4);
  section.appendChild(dot);
  dot.x = (index % 20) * 8;
  dot.y = 700 + Math.floor(index / 20) * 8;
  dots.push(dot);
}
figma.currentPage.selection = dots;
return dots.length;`);

    const answer = await inspect({});

    expect(answer.layers).toHaveLength(100);
    expect(answer.left).toBe(1);
  });

  // T-084: two plan cards side by side, measured in page px.
  it("measures the gap from the Starter card to the Pro card in a sentence", async () => {
    const answer = (await client.call("measure", { file, nodes: [planStarter, planPro] })) as {
      measured: string;
      pairs: { gap: { x: number }; summary: string }[];
    };
    const [pair] = answer.pairs;

    expect(answer.measured).toBe("box");
    expect(pair?.gap.x).toBeGreaterThan(0);
    expect(pair?.summary).toMatch(new RegExp(`^${planPro} ".+" is [\\d.]+ px right of ${planStarter} ".+"`));
  });

  // The answer key: the coverage frame's auto layout sides off a 4 px scale, as CSS longhands.
  it("reads auto layout and grid numbers under design_read's CSS names, 185:437's as design_read writes them", async () => {
    const off: Record<string, Record<string, number>> = {
      "185:274": { "padding-right": 10, "padding-left": 10 },
      "185:437": { "padding-top": 6, "padding-bottom": 6, gap: 6 },
      "185:448": { "padding-top": 6, "padding-bottom": 6, gap: 6 },
    };
    const { layers } = (await client.call("inspect", { file, nodes: [...Object.keys(off), "185:259"] })) as {
      layers: { id: string; layout?: Record<string, string | number> }[];
    };
    const layout = Object.fromEntries(layers.map(({ id, layout: read }) => [id, read ?? {}]));
    const [xml = ""] = await client.texts("design_read", { file, node: "185:437" });
    const chip = /<\w+ id="185:437"[^>]*>/.exec(xml)?.[0] ?? "";
    const attribute = (name: string) => new RegExp(` ${name}="([^"]*)"`).exec(chip)?.[1];
    const [top, right = top, bottom = top, left = right] = (attribute("padding") ?? "").split(" ");
    const px = (value: string | undefined) => Number.parseFloat(value ?? "0");

    for (const [id, sides] of Object.entries(off)) {
      expect(layout[id]).toMatchObject(sides);
    }

    expect(layout["185:259"]?.display).toBe("grid");
    expect(layout["185:437"]).toMatchObject({
      display: attribute("display"),
      "padding-top": px(top),
      "padding-right": px(right),
      "padding-bottom": px(bottom),
      "padding-left": px(left),
      gap: px(attribute("gap")),
    });
  });

  it("says the Starter card's stroke colour is bound, as its fills say theirs", async () => {
    const { layers } = (await client.call("inspect", { file, nodes: [planStarter] })) as {
      layers: { strokes?: { colors: string[]; tokens?: Record<string, string> } }[];
    };

    expect(layers[0]?.strokes?.tokens).toEqual({ "--color-line": "#E1E5EE" });
  });

  // RG-3 coverage: each case computes the truth with the Plugin API code an agent wrote, then asks inspect.
  describe("RG-3: what agents wrote execute for", () => {
    const startFrame = "185:239";

    // Gap 1 (T4): every auto layout gap and padding inside a frame, one call.
    it("lists the auto layout frames inside 185:239 with their paddings, as findAll(layoutMode != NONE) does", async () => {
      const truth = (await run(`const root = await pw.node(${JSON.stringify(startFrame)});
return [root, ...root.findAll(() => true)]
  .filter((node) => node.visible && "layoutMode" in node && node.layoutMode !== "NONE")
  .map((node) => ({ id: node.id, paddingTop: node.paddingTop, paddingLeft: node.paddingLeft }));`)) as {
        id: string;
        paddingTop: number;
        paddingLeft: number;
      }[];
      const answer = (await inspect({ within: startFrame, fields: ["layout"] })) as Inspected & {
        more?: true;
        leftIds?: string[];
      };
      const layers = answer.layers as unknown as { id: string; layout?: Record<string, number | string> }[];

      expect(truth.length).toBeGreaterThan(0);
      expect(answer.more).toBeUndefined();
      expect(layers.map(({ id }) => id).sort()).toEqual(truth.map(({ id }) => id).sort());

      // The layout group leaves default values out, as design_read does: no padding key means 0.
      for (const { id, paddingTop, paddingLeft } of truth) {
        const layout = layers.find((layer) => layer.id === id)?.layout ?? {};

        expect({ top: layout["padding-top"] ?? 0, left: layout["padding-left"] ?? 0 }).toEqual({
          top: paddingTop,
          left: paddingLeft,
        });
      }
    });

    it("reads the layer alone at depth 0, and lists the ids it left past 100 layers", async () => {
      const alone = (await inspect({ within: startFrame, depth: 0 })) as Inspected;
      const total = (await run(`const root = await pw.node(${JSON.stringify(startFrame)});
return 1 + root.findAll(() => true).length;`)) as number;
      const all = (await inspect({ within: startFrame })) as Inspected & { more?: true; leftIds?: string[] };

      expect(alone.layers.map(({ id }) => id)).toEqual([startFrame]);
      expect(all.layers.length + (all.leftIds?.length ?? 0)).toBe(total);
      expect(all.more === true).toBe(total > 100);
    });

    // Gap 2: a layer in auto layout carries its parent's layout.
    it("gives a layer in auto layout its parent's layout: padding, and the gap when it has company", async () => {
      const truth = (await run(`const card = await pw.node(${JSON.stringify(planStarter)});
const child = card.findAll((node) => node.parent && "layoutMode" in node.parent && node.parent.layoutMode !== "NONE")[0];
const parent = child.parent;
return { id: child.id, mode: parent.layoutMode, wrap: parent.layoutWrap, gap: parent.itemSpacing, count: parent.children.length, paddingTop: parent.paddingTop, paddingLeft: parent.paddingLeft };`)) as {
        id: string;
        mode: string;
        wrap: string;
        gap: number;
        count: number;
        paddingTop: number;
        paddingLeft: number;
      };
      const [layer] = (await inspect({ nodes: [truth.id] })).layers as unknown as {
        parentLayout?: Record<string, number | string>;
      }[];

      expect(layer?.parentLayout).toMatchObject({ "padding-top": truth.paddingTop, "padding-left": truth.paddingLeft });

      if (truth.count > 1 && truth.wrap === "NO_WRAP") {
        expect(layer?.parentLayout?.gap).toBe(truth.gap);
      }
    });

    // Gap 3: a layer inside an instance is read by its nested id.
    it("reads a layer inside an instance by its nested id, I54:244;...", async () => {
      const truth = (await run(`const card = await pw.node(${JSON.stringify(planStarter)});
const inner = card.findAll(() => true)[0];
return { id: inner.id, name: inner.name, type: inner.type };`)) as { id: string; name: string; type: string };
      const answer = (await inspect({ nodes: [truth.id] })) as Inspected & { missing: string[] };

      expect(truth.id).toMatch(/^I/);
      expect(answer.missing).toEqual([]);
      expect(answer.layers[0]).toMatchObject(truth);
    });

    // Gap 4: the runs of a text that mixes styles; none for one style.
    it("lists a mixed text's runs as getStyledTextSegments gives them, and none for a text of one style", async () => {
      const made = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
const text = figma.createText();
text.name = ${JSON.stringify(`${PREFIX}runs`)};
section.appendChild(text);
text.characters = "Save 20% today";
text.setRangeFontName(5, 8, { family: "Inter", style: "Bold" });
text.setRangeFontSize(5, 8, 24);
text.setRangeTextDecoration(5, 8, "UNDERLINE");
const card = await pw.node(${JSON.stringify(planStarter)});
const plain = card.findAll((node) => node.type === "TEXT" && node.getStyledTextSegments(["fontSize"]).length === 1)[0];
return {
  id: text.id,
  plain: plain.id,
  segments: text.getStyledTextSegments(["fontSize", "fontName", "textDecoration"]).map(({ start, end, characters, fontSize, fontName, textDecoration }) => ({ start, end, characters, fontSize, fontFamily: fontName.family, fontStyle: fontName.style, textDecoration })),
};`)) as { id: string; plain: string; segments: unknown[] };
      const layers = (await inspect({ nodes: [made.id, made.plain] })).layers as unknown as {
        text?: { segments?: unknown[] };
      }[];

      expect(made.segments.length).toBeGreaterThan(1);
      expect(layers[0]?.text?.segments).toMatchObject(made.segments);
      expect(layers[1]?.text?.segments).toBeUndefined();
    });

    // Gap 5: the way up with ids, the shape nodes_find gives.
    it("gives a layer's ancestors with ids up to its page, as findAll's parent chain and nodes_find do", async () => {
      const truth = (await run(`const card = await pw.node(${JSON.stringify(planStarter)});
const inner = card.findAll((node) => node.type === "TEXT")[0];
const path = [];
for (let node = inner.parent; node && node.type !== "PAGE"; node = node.parent) path.unshift({ id: node.id, name: node.name, type: node.type });
return { id: inner.id, path };`)) as { id: string; path: { id: string; name: string; type: string }[] };
      const [layer] = (await inspect({ nodes: [truth.id] })).layers as unknown as { path?: unknown[] }[];
      const found = (await client.call("nodes_find", { file, within: planStarter, type: "TEXT" })) as {
        nodes: { id: string; path: unknown[] }[];
      };

      expect(layer?.path).toEqual(truth.path);
      expect(found.nodes.find(({ id }) => id === truth.id)?.path).toEqual(truth.path);
    });
  });
});
