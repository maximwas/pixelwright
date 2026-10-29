import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const START_HERE = TEST_MCP.pages[0];

interface MapLayer {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly devStatus?: string;
  readonly children?: MapLayer[];
}

interface MapPage {
  readonly name: string;
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
