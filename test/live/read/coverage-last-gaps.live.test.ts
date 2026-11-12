import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

/** Layers of 185:239, the coverage frame of Test MCP, read only. */
const COVERAGE = {
  /** A see-through layer whose drop shadow Figma shows behind it (showShadowBehindNode), without a spread. */
  shadowBehind: "185:334",
  /** A 24px radius with 60% corner smoothing. */
  smoothing: "185:393",
  /** A layer whose click opens a URL in a new tab. */
  newTab: "185:504",
  /** A locked layer. */
  locked: "185:510",
} as const;

type Flows = { links: { layer: { id: string }; url?: string; summary: string }[] };

/** The opening tag of the XML's root element. */
function rootTag(xml: string): string {
  return xml.slice(0, xml.indexOf(">"));
}

// Reads only: no layer is made or changed.
describe("read/coverage-last-gaps", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  async function root(node: string): Promise<string> {
    const [xml = ""] = await client.texts("design_read", { file, node });

    return rootTag(xml);
  }

  it("writes a drop shadow shown behind a see-through layer as filter drop-shadow(), not a box-shadow", async () => {
    const tag = await root(COVERAGE.shadowBehind);

    expect(tag).toMatch(/ filter="drop-shadow\(/);
    expect(tag).not.toContain("box-shadow=");
    expect(tag).not.toContain("shadow-behind:");
  });

  it("keeps a smoothed corner's border-radius and notes Figma's smoothing in $css", async () => {
    const tag = await root(COVERAGE.smoothing);

    expect(tag).toMatch(/ border-radius="(24px|var\(--[^)]+\))"/);
    expect(tag).toMatch(/ \$css="[^"]*corner-smoothing: 60%/);
  });

  it("writes a link that opens in a new tab with target _blank after its href", async () => {
    expect(await root(COVERAGE.newTab)).toMatch(/ href="[^"]+" target="_blank"/);
  });

  it("says a locked layer is locked", async () => {
    expect(await root(COVERAGE.locked)).toContain(' $locked="true"');
  });

  it("says in flow_read that the link opens in a new tab", async () => {
    const flows = (await client.call("flow_read", { file, page: TEST_MCP.ids.startHere })) as Flows;
    const link = flows.links.find(({ layer }) => layer.id === COVERAGE.newTab);

    expect(link?.url).toBeDefined();
    expect(link?.summary).toMatch(/ in a new tab$/);
  });
});
