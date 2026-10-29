import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startSection, install } = TEST_MCP.ids;

/** The page names an outline of the document lists, in order. */
const pageNames = (xml: unknown): string[] =>
  [...String(xml).matchAll(/<Page id="[^"]+" name="([^"]+)"\/>/g)].map(([, name]) => name ?? "");

// It only reads: nothing to clean up, and a failed case may run again.
describe("read/outline", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

  it("lists the file's three pages for 0:0 (T-044)", async () => {
    const { xml, nodes } = await client.call("outline", { file, node: "0:0" });

    expect(pageNames(xml)).toEqual([...TEST_MCP.pages]);
    expect(nodes).toBe(TEST_MCP.pages.length + 1);
  });

  it("outlines the Start here section from its own corner, the Install card two levels down (T-044)", async () => {
    const { xml } = await client.call("outline", { file, node: startSection, depth: 2 });

    expect(String(xml)).toMatch(new RegExp(`^<Section id="${startSection}" name="[^"]*" x="0" y="0" `));
    expect(String(xml)).toContain(`id="${install}"`);
  });

  it("refuses depth 11: ten levels at most (T-044)", async () => {
    await expect(client.call("outline", { file, node: startSection, depth: 11 })).rejects.toThrow(/depth/);
  });
});
