import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const START_HERE = TEST_MCP.pages[0];

interface MapLayer {
  readonly id: string;
  readonly name: string;
  readonly childCount?: number;
  readonly width: number;
  readonly height: number;
  readonly devStatus?: string;
  readonly children?: MapLayer[];
}

interface MapPage {
  readonly id: string;
  readonly name: string;
  readonly childCount?: number;
  readonly current: boolean;
  readonly nodes?: MapLayer[];
}

// It only reads: nothing to clean up, and a failed case may run again.
describe("read/file_map", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

  // Gap 3: the counts plugin code read from children.length, of each page and of each layer the map lists.
  it("gives each page's top-level layer count and each listed layer's children count", async () => {
    const { pages } = await client.call("file_map", { file });
    const truth = await run(`await figma.loadAllPagesAsync();
return figma.root.children.map((page) => ({
  id: page.id,
  childCount: page.children.length,
  layers: Object.fromEntries([...page.children, ...page.children.flatMap((node) => node.type === "SECTION" ? node.children : [])].map((node) => [node.id, "children" in node ? node.children.length : null])),
}));`);
    const answer = (pages as MapPage[]).map(({ id, childCount, nodes = [] }) => ({
      id,
      childCount,
      layers: Object.fromEntries(
        [...nodes, ...nodes.flatMap(({ children = [] }) => children)].map((node) => [node.id, node.childCount ?? null]),
      ),
    }));

    expect(answer).toEqual(truth);
  });

  it("maps the three pages, the current one marked, Pricing – Desktop ready for dev, sizes in whole px (T-034)", async () => {
    const { pages, more, pagesNotRead } = await client.call("file_map", { file });
    const mapped = pages as MapPage[];
    const layers = mapped.flatMap(({ nodes = [] }) => [...nodes, ...nodes.flatMap(({ children = [] }) => children)]);

    expect(mapped.map(({ name }) => name)).toEqual([...TEST_MCP.pages]);
    expect(mapped.filter(({ current }) => current).map(({ name }) => name)).toEqual([START_HERE]);
    expect(layers).toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/^Pricing . Desktop$/), devStatus: "ready" }),
    );
    expect(layers.every(({ width, height }) => Number.isInteger(width) && Number.isInteger(height))).toBe(true);
    expect(more).toBe(false);
    expect(pagesNotRead).toBeUndefined();
  });
});
