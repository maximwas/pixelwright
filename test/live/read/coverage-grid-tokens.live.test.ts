import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import * as zod from "zod/mini";
import { TokensSchema } from "@/core/tokens/model/model.schema.ts";
import { LiveClient } from "../support/live-client.ts";

/** The coverage frame of Test MCP, the fixture of read-only live cases: read only, never changed. */
const COVERAGE = "185:239";

/** The bento's children: Wide spans two columns, Row two spans two from column 2, the Dot sits centred. */
const BENTO = ["185:260", "185:261", "185:262", "185:263"];

/** Section 2, Fills: a 200 x 120 tile is bound to the Orbit/Gradient paint style. */
const FILLS = "185:282";

const TOKEN = "--Orbit-Gradient";

// Reads only: no layer is made or changed.
describe("read/coverage-grid-tokens", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  // C-058: each grid child names its cell, so the bento keeps its spans instead of flowing cell by cell.
  it("gives each child of the bento its grid-column and grid-row", async () => {
    const { result } = await client.call("execute", {
      file,
      code: `return (await pw.node(${JSON.stringify(BENTO[0])})).parent.id;`,
    });
    const [xml = ""] = await client.texts("design_read", { file, node: String(result) });
    const lines = xml.split("\n");

    expect(lines[0]).toContain('display="grid"');

    for (const id of BENTO) {
      const line = lines.find((row) => row.includes(`id="${id}"`)) ?? "";

      expect(line, id).toMatch(/ grid-row="\d+( \/ span \d+)?"/);
      expect(line, id).toMatch(/ grid-column="\d+( \/ span \d+)?"/);
    }

    expect(xml).toContain('grid-column="1 / span 2"');
  });

  // A token is one value: design_read's JSON and tokens_read give the gradient style the same one; the tile whose box
  // is no square has its own angle in a hint.
  it("gives --Orbit-Gradient one value in design_read and tokens_read", async () => {
    const [, json = "null"] = await client.texts("design_read", { file, node: FILLS });
    const read = JSON.parse(json) as { tokens: Record<string, string>; hints: string[] };
    const { tokens } = await client.call("tokens_read", { file, format: "json", within: COVERAGE });
    const style = zod.parse(TokensSchema, tokens).styles.paint.find(({ token }) => token === TOKEN);

    expect(read.tokens[TOKEN]).toMatch(/^linear-gradient\(/);
    expect(read.tokens[TOKEN]).toBe(style?.value);
    expect(read.hints.some((hint) => hint.startsWith(`${TOKEN} is `) && hint.includes("149.04deg"))).toBe(true);
  });
});
