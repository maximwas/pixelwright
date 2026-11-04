import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startSection } = TEST_MCP.ids;
// Plan Card is a plain component with 10 instances (Pricing – Desktop, Mobile, Tablet, and 185:461 in the coverage
// frame 185:239 on Start here); Button is a variant set, and
// "Sign in" 54:236 is its Variant=Secondary, State=Default. Like 0.7.0, `name` matches layer names only and
// `component` matches the main component or its set (the plan's Try-it used `name` for Plan Card, which finds only
// the component itself).
const PLAN_CARD = "Plan Card";
const PLAN_CARD_INSTANCES = 10;
const BUTTON = "Button";
const SIGN_IN = "54:236";

interface Found {
  readonly id: string;
  readonly type: string;
  readonly path: string[];
}

interface Counted {
  readonly component: string;
  readonly variant?: string;
  readonly count: number;
}

// It only reads: nothing to clean up, and a failed case may run again.
describe("read/nodes_find", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

  it("finds Plan Card's instances within the file, page by page, with paths and counts (T-040, T-041, T-042)", async () => {
    const { nodes, more, counts, countsCut } = await client.call("nodes_find", {
      file,
      component: PLAN_CARD,
      within: "file",
      counts: true,
    });
    const found = nodes as Found[];

    expect(found).toHaveLength(PLAN_CARD_INSTANCES);
    expect(found.every(({ type, path }) => type === "INSTANCE" && path.length > 0)).toBe(true);
    expect(more).toBe(false);
    expect(countsCut).toBeUndefined();
    expect(counts as Counted[]).toEqual([{ component: PLAN_CARD, count: PLAN_CARD_INSTANCES }]);
  });

  it("finds the instances of one variant, its values in another order and case (T-040)", async () => {
    const { nodes, variant } = await client.call("nodes_find", {
      file,
      component: BUTTON,
      variant: "state=default, variant=secondary",
      within: "file",
    });

    expect((nodes as Found[]).map(({ id }) => id)).toContain(SIGN_IN);
    expect(variant).toEqual({ state: "default", variant: "secondary" });
  });

  it("searches the current page when within is left out (S-043)", async () => {
    const { pages } = await client.call("file_map", { file });
    const current = (pages as { id: string; name: string; current: boolean }[]).find((page) => page.current);
    // T-040: without within the answer also names the page it searched.
    const { page, ...onPage } = await client.call("nodes_find", { file, type: "SECTION" });

    expect(page).toBe(current?.name);
    expect(onPage).toEqual(await client.call("nodes_find", { file, type: "SECTION", within: current?.id }));
    expect((onPage.nodes as Found[]).map(({ id }) => id)).toContain(startSection);
  });
});
