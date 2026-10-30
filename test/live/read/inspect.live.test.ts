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
});
