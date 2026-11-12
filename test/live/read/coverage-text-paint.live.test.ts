import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

/** Layers of 185:239, the coverage frame of Test MCP, read only. */
const COVERAGE = {
  /** Bold, italic, underline, strike and colour runs; the underlined run is the longest. */
  mixedRuns: "185:421",
  /** White text with an outside 2px stroke. */
  textStroke: "185:430",
  /** Two fills, the top one MULTIPLY. */
  fillBlend: "185:368",
} as const;

/** The opening tag of the XML's root element. */
function rootTag(xml: string): string {
  return xml.slice(0, xml.indexOf(">"));
}

describe("read/coverage-text-paint", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it("underlines only the underlined run: its Span has the decoration, the Text has none", async () => {
    const [xml = ""] = await client.texts("design_read", { file, node: COVERAGE.mixedRuns });

    expect(rootTag(xml)).not.toContain("text-decoration=");
    expect(xml.match(/<Span [^>]*text-decoration="underline"/g)).toHaveLength(1);
    expect(xml).toMatch(/<Span [^>]*text-decoration="line-through"/);
  });

  it("writes a text's outside stroke as a doubled -webkit-text-stroke painted under the fill", async () => {
    const [xml = ""] = await client.texts("design_read", { file, node: COVERAGE.textStroke });

    expect(rootTag(xml)).toMatch(/ -webkit-text-stroke="4px (#3B2FD9|var\(--[^)]+\))"/);
    expect(rootTag(xml)).toContain(' paint-order="stroke fill"');
  });

  it("writes the top fill's MULTIPLY as background-blend-mode, one mode per background", async () => {
    const [xml = ""] = await client.texts("design_read", { file, node: COVERAGE.fillBlend });

    expect(rootTag(xml)).toContain(' background-blend-mode="multiply, normal"');
  });
});
