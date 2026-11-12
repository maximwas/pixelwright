import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { hero, heroB, signIn, pricingDesktop, orbitPricing, checkoutPay, success } = TEST_MCP.ids;

type Diff = { same: boolean; onlyInA: unknown[]; onlyInB: unknown[]; changed: { path: string; drawing?: boolean }[] };
type Variants = { variants: { name: string; pseudo?: string }[] };
type Breakpoints = { widths: { id: string; width: number; this?: true }[] };
type Flows = { starts: unknown[]; links: { layer: { id: string }; to: { id: string; name: string } | null }[] };

/** The prefix of the layers this file makes in the Live tests Section, removed after. */
const PREFIX = "live:diff:";

// Reads, on Orbit as Test MCP has it (m:8cfa2bfd), but for two drawings made in the Live tests Section
// (live:diff:<case>, removed after), since no two layers of Test MCP differ in their outline alone.
describe("read/diff", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    await client.close();
  });

  // T-085: Hero – B is Hero with another eyebrow and title.
  it("tells Hero and Hero – B apart by their eyebrow and title alone", async () => {
    const diff = (await client.call("nodes_diff", { file, a: hero, b: heroB })) as Diff;
    const paths = diff.changed.map(({ path }) => path);

    expect(diff).toMatchObject({ same: false, onlyInA: [], onlyInB: [] });
    expect(paths).toHaveLength(2);
    expect(paths).toEqual([expect.stringMatching(/eyebrow/i), expect.stringMatching(/title/i)]);
  });

  // T-086: Sign in is a Button instance, so the Button set is read (Plan Card is a lone component).
  it("reads the Button set's Hover state as :hover", async () => {
    const view = (await client.call("variants_read", { file, node: signIn })) as Variants;

    expect(view.variants).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/hover/i), pseudo: ":hover" }),
    );
  });

  // T-087: Pricing at 375, 768 and 1440; Success – Desktop, also 1440, is another screen.
  it("finds Pricing at 375, 768 and 1440, Desktop being the one asked about", async () => {
    const { widths } = (await client.call("breakpoints_find", { file, node: pricingDesktop })) as Breakpoints;

    expect(widths.map(({ width }) => width)).toEqual([375, 768, 1440]);
    expect(widths.at(-1)).toMatchObject({ id: pricingDesktop, this: true });
  });

  // T-088: Checkout's Pay goes to Success.
  it("maps the Pricing page's prototype with Checkout's Pay leading to Success", async () => {
    const flows = (await client.call("flow_read", { file, page: orbitPricing })) as Flows;

    expect(Array.isArray(flows.starts)).toBe(true);
    expect(flows.links).toContainEqual(
      expect.objectContaining({
        layer: expect.objectContaining({ id: checkoutPay }),
        to: expect.objectContaining({ id: success }),
      }),
    );
  });

  // T-085, K-052: two drawings alike in size, fill and names but not in outline differ by their paths' hash.
  it("names the drawing changed between a square and a triangle in frames alike in all else", async () => {
    const [square = "", triangle = ""] = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const outlines = [["square", "M 0 0 L 24 0 L 24 24 L 0 24 Z"], ["triangle", "M 0 0 L 24 0 L 0 24 Z"]];
return outlines.map(([shape, data], index) => {
  const frame = figma.createFrame();
  frame.name = ${JSON.stringify(PREFIX)} + shape;
  frame.resize(24, 24);
  frame.fills = [];
  const vector = figma.createVector();
  vector.name = "Drawing";
  vector.vectorPaths = [{ windingRule: "NONZERO", data }];
  vector.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  frame.appendChild(vector);
  section.appendChild(frame);
  frame.x = index * 40;
  return frame.id;
});`)) as string[];
    const diff = (await client.call("nodes_diff", { file, a: square, b: triangle })) as Diff;

    expect(diff.same).toBe(false);
    expect(diff.changed).toContainEqual(expect.objectContaining({ drawing: true }));
  });
});
