import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { hero, heroB, planStarter, pricingDesktop, orbitPricing, checkoutPay, success } = TEST_MCP.ids;

type Diff = { same: boolean; onlyInA: unknown[]; onlyInB: unknown[]; changed: { path: string }[] };
type Variants = { variants: { name: string; pseudo?: string }[] };
type Breakpoints = { widths: { id: string; width: number; this?: true }[] };
type Flows = { starts: unknown[]; links: { layer: { id: string }; to: { id: string; name: string } | null }[] };

// Reads only, on Orbit as Test MCP has it (m:8cfa2bfd): nothing is written.
describe("read/diff", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
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

  // T-086: the Starter card is a Plan Card instance, so its set is read.
  it("reads Plan Card's Hover state as :hover", async () => {
    const view = (await client.call("variants_read", { file, node: planStarter })) as Variants;

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
});
