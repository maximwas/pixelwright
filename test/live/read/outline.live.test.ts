import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { startSection, install, pricingDesktop } = TEST_MCP.ids;

/** Each layer's id and box corner as an outline's XML writes them. */
const corners = (xml: unknown): { id: string; x: number; y: number }[] =>
  [...String(xml).matchAll(/<\w+ [^>]*>/g)]
    .map(([tag]) => ({
      id: /\bid="([^"]+)"/.exec(tag)?.[1],
      x: /\bx="([^"]+)"/.exec(tag)?.[1],
      y: /\by="([^"]+)"/.exec(tag)?.[1],
    }))
    .flatMap(({ id, x, y }) =>
      id === undefined || x === undefined || y === undefined ? [] : [{ id, x: Number(x), y: Number(y) }],
    );

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

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

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

  // Gap 3: the page coordinates plugin code read from absoluteBoundingBox, for the frame and its children.
  it("gives every box in page coordinates with absolute: true", async () => {
    const { xml } = await client.call("outline", { file, node: pricingDesktop, depth: 1, absolute: true });
    const truth = await run(`const root = await figma.getNodeByIdAsync(${JSON.stringify(pricingDesktop)});
return [root, ...root.children].map((node) => ({ id: node.id, x: Math.round(node.absoluteBoundingBox.x), y: Math.round(node.absoluteBoundingBox.y) }));`);

    expect(corners(xml)).toEqual(truth);
  });

  it("refuses depth 11: ten levels at most (T-044)", async () => {
    await expect(client.call("outline", { file, node: startSection, depth: 11 })).rejects.toThrow(/depth/);
  });
});
