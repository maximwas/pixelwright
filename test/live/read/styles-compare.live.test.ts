import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient, type ToolResult } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;

interface Compared extends ToolResult {
  readonly layers: {
    readonly node: string;
    readonly mismatches: { readonly property: string; readonly design: string; readonly build: string }[];
    readonly notGiven: string[];
  }[];
  readonly missing: string[];
  readonly same: boolean;
}

/** A value no computed style holds: every property given it differs from the design. */
const UNLIKE = "unlike-the-design";

// Reads only: nothing to make or sweep.
describe("read/styles-compare", () => {
  const { file } = inject("live");
  let client: LiveClient;
  /** design_read's gap on the Install card. */
  let gap: string;
  /** The Install card's own values, property by property, as styles_compare reads the design's. */
  let own: Record<string, string>;

  const compare = async (css: Record<string, string>): Promise<Compared> =>
    (await client.call("styles_compare", { file, pairs: [{ node: install, css }] })) as Compared;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();

    const [xml = ""] = await client.texts("design_read", { file, node: install });
    const blank = await compare({});
    const unlike = await compare(Object.fromEntries((blank.layers[0]?.notGiven ?? []).map((name) => [name, UNLIKE])));

    gap = /^<\w+ [^>]*\bgap="([^"]+)"/.exec(xml)?.[1] ?? "";
    own = Object.fromEntries((unlike.layers[0]?.mismatches ?? []).map(({ property, design }) => [property, design]));
  });

  afterAll(() => client.close());

  it("finds the Install card's own values the same, every property design_read sets given", async () => {
    const result = await compare(own);

    expect(gap).not.toBe("");
    expect(Object.keys(own).length).toBeGreaterThan(5);
    expect(result).toMatchObject({
      same: true,
      missing: [],
      layers: [{ node: install, mismatches: [], notGiven: [] }],
    });
  });

  it("names the gap alone when the build's gap is 2 px wider", async () => {
    const main = own["row-gap"] === undefined ? "column-gap" : "row-gap";
    const design = own[main] ?? "";
    const wider = `${Number.parseFloat(design) + 2}px`;
    const result = await compare({ ...own, "row-gap": wider, "column-gap": wider });

    expect(result.same).toBe(false);
    expect(result.layers[0]?.mismatches).toEqual([expect.objectContaining({ property: main, design, build: wider })]);
  });
});
