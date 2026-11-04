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

/** The prefix of the layers this file makes in the Live tests Section, removed after. */
const PREFIX = "live:styles-compare:";

/** What says how a layer sits in an auto layout parent: how it fills it. */
const PLACE = new Set(["align-self", "flex-grow"]);

/** A value no computed style holds: every property given it differs from the design. */
const UNLIKE = "unlike-the-design";

// Reads, but for a hidden copy of the Install card made in the Live tests Section (live:styles-compare:<case>,
// removed after).
describe("read/styles-compare", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
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

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    await client.close();
  });

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

  // T-090, 0.7.0's decision 1: a layer compared alone is written as design_read writes it in its parent.
  it("compares a child of the Install card alone in its place there: how it fills the card", async () => {
    const child = (await run(`const card = await pw.node(${JSON.stringify(install)});
const filling = card.children.find((node) => node.visible && (node.layoutSizingHorizontal === "FILL" || node.layoutSizingVertical === "FILL"));
return filling === undefined ? null : filling.id;`)) as string | null;

    expect(child).not.toBeNull();

    const result = (await client.call("styles_compare", {
      file,
      pairs: [{ node: String(child), css: {} }],
    })) as Compared;

    expect(result.layers[0]?.notGiven.filter((name) => PLACE.has(name))).not.toEqual([]);
  });

  // T-090: a hidden layer is compared as shown, not only noted: the read op reads a hidden root whole.
  it("compares a hidden copy of the Install card as shown", async () => {
    const copy = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const copy = (await pw.node(${JSON.stringify(install)})).clone();
copy.name = ${JSON.stringify(`${PREFIX}hidden`)};
section.appendChild(copy);
copy.visible = false;
return copy.id;`)) as string;
    const result = (await client.call("styles_compare", { file, pairs: [{ node: copy, css: {} }] })) as Compared;

    expect(result.layers[0]?.notGiven).toEqual(expect.arrayContaining(["display"]));
  });
});
