import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import * as zod from "zod/mini";
import { TokensSchema } from "@/core/tokens/model/model.schema.ts";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;

/** The prefix of the layers this file makes in the Live tests Section, removed after. */
const PREFIX = "live:tokens:";

/** Every custom property the CSS declares, and every one its values name in var(). */
const declared = (css: string): Set<string> =>
  new Set([...css.matchAll(/^\s*(--[^:\s]+):/gm)].map(([, name]) => name ?? ""));

// Comments left out: the text styles' heading shows the use, `font: var(--name-font)`, with no such token.
const referenced = (css: string): Set<string> =>
  new Set([...css.replaceAll(/\/\*[\s\S]*?\*\//g, "").matchAll(/var\((--[^),\s]+)/g)].map(([, name]) => name ?? ""));

// Reads, but for one text made in the Live tests Section (live:tokens:<case>, removed after), since no text of Test
// MCP has a style in one run alone.
describe("read/tokens", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    await client.close();
  });

  it("writes Test MCP's spacing, radius and text style tokens as CSS in :root (T-160, T-164, K-006)", async () => {
    const { format, css } = await client.call("tokens_read", { file });

    expect(format).toBe("css");
    expect(String(css)).toMatch(/^:root \{\n/);
    expect(String(css)).toContain("--space-24: 24px;");
    expect(String(css)).toMatch(/--radius-md: [\d.]+px;/);
    expect(String(css)).toMatch(/--body-font: .+px\/.+;/i);
    expect(String(css)).toMatch(/--button[^:]*-font: .+px\/.+;/i);
  });

  it("defines every var() its CSS uses, or says in notes where it lives (K-005)", async () => {
    const { css, notes } = await client.call("tokens_read", { file });
    const missing = [...referenced(String(css))].filter((name) => !declared(String(css)).has(name));

    expect(missing.filter((name) => !JSON.stringify(notes).includes(name))).toEqual([]);
  });

  it("keeps only the collections asked for, by name in any case (T-160)", async () => {
    const all = await client.call("tokens_read", { file });
    const name = String(all.css).match(/^ {2}\/\* (.+) \*\/$/m)?.[1] ?? "";
    const { css } = await client.call("tokens_read", { file, collections: [name.toUpperCase()], used: false });

    expect(name).not.toBe("");
    expect(String(css)).toContain(`/* ${name} */`);
    expect(String(css).match(/^ {2}\/\* (?!Paint|Effect|Text)(.+) \*\/$/gm)).toEqual([`  /* ${name} */`]);
  });

  it("writes format json that parses back into the model, --space-24 among its variables (T-160)", async () => {
    const { format, tokens } = await client.call("tokens_read", { file, format: "json" });
    const model = zod.parse(TokensSchema, tokens);

    expect(format).toBe("json");
    expect(model).toEqual(tokens);
    expect(model.collections.flatMap(({ variables }) => variables.map(({ token }) => token))).toContain("--space-24");
  });

  it("gives the summary past maxChars: the first whole tokens that fit, and the collections to read (T-161)", async () => {
    const { css, summary, notes } = await client.call("tokens_read", { file, maxChars: 500 });

    expect(String(css).length).toBeLessThanOrEqual(500);
    expect(summary).toMatchObject({
      collections: expect.arrayContaining([expect.objectContaining({ variables: expect.any(Number) })]),
    });
    expect(JSON.stringify(notes)).toContain("past maxChars (500)");
  });

  it("lists the Install card among the layers that use --space-24 (T-106)", async () => {
    const { kind, layers } = await client.call("tokens_usage", { file, token: "--space-24", within: "file" });

    expect(kind).toBe("variable");
    expect(layers).toContainEqual(expect.objectContaining({ id: install }));
  });

  it("stops the scan when its budget is spent, with a note (D-48)", async () => {
    const { more, notes } = await client.call("tokens_usage", {
      file,
      token: "--space-24",
      within: "file",
      budgetMs: 1,
    });

    expect(more).toBe(true);
    expect(JSON.stringify(notes)).toContain("budget of 1 ms");
  });

  it("finds a paint style one run of a text alone uses (P-096, O-024)", async () => {
    const made = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const style = (await figma.getLocalPaintStylesAsync())[0];
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const text = figma.createText();
text.name = ${JSON.stringify(`${PREFIX}run`)};
section.appendChild(text);
text.characters = "Plain accent";
await text.setRangeFillStyleIdAsync(6, 12, style.id);
return { id: text.id, style: style.name };`)) as { id: string; style: string };
    const { tokens } = await client.call("tokens_read", { file, format: "json", within: made.id });
    const token = zod.parse(TokensSchema, tokens).styles.paint.find(({ name }) => name === made.style)?.token;
    const { layers } = await client.call("tokens_usage", { file, token, within: made.id });

    expect(layers).toEqual([expect.objectContaining({ id: made.id, property: "a text run" })]);
  });
});
