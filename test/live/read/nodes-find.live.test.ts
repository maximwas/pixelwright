import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startSection } = TEST_MCP.ids;
const PLAN_CARD = "Plan Card";

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

  it("finds Plan Card within the file, page by page, its instances counted by variant (T-040, T-041, T-042)", async () => {
    const { nodes, more, counts, countsCut } = await client.call("nodes_find", {
      file,
      name: PLAN_CARD,
      within: "file",
      counts: true,
    });
    const found = nodes as Found[];
    const counted = counts as Counted[];
    const instances = found.filter(({ type }) => type === "INSTANCE");

    expect(instances.length).toBeGreaterThan(0);
    expect(found.every(({ path }) => Array.isArray(path))).toBe(true);
    expect(more).toBe(false);
    expect(countsCut).toBeUndefined();
    expect(counted.length).toBeGreaterThan(0);
    expect(counted.every(({ component, count }) => component.includes(PLAN_CARD) && count >= 1)).toBe(true);
    expect(counted.reduce((sum, { count }) => sum + count, 0)).toBeGreaterThanOrEqual(instances.length);
  });

  it("finds the instances of one variant, its values in another order and case (T-040)", async () => {
    const { counts } = await client.call("nodes_find", { file, component: PLAN_CARD, within: "file", counts: true });
    const [first] = counts as Counted[];
    const asked = (first?.variant ?? "").split(", ").toReversed().join(", ").toLowerCase();

    const { nodes, variant } = await client.call("nodes_find", {
      file,
      component: PLAN_CARD,
      variant: asked,
      within: "file",
      limit: 500,
    });

    expect((nodes as Found[]).length).toBe(first?.count);
    expect(Object.keys(variant as object)).toHaveLength((first?.variant ?? "").split(", ").length);
  });

  it("searches the current page when within is left out (S-043)", async () => {
    const { pages } = await client.call("file_map", { file });
    const current = (pages as { id: string; current: boolean }[]).find((page) => page.current);
    const onPage = await client.call("nodes_find", { file, type: "SECTION" });

    expect(onPage).toEqual(await client.call("nodes_find", { file, type: "SECTION", within: current?.id }));
    expect((onPage.nodes as Found[]).map(({ id }) => id)).toContain(startSection);
  });
});
