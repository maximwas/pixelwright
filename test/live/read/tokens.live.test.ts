import { defineConfig, parse } from "@terrazzo/parser";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import * as zod from "zod/mini";
import { TokensSchema } from "@/core/tokens/model/model.schema.ts";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install, pricingDesktop, planStarter } = TEST_MCP.ids;

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

  it("writes format dtcg: a tree per collection mode and one of styles, colours as colorSpace objects, which Terrazzo parses (K-013, K-016)", async () => {
    const { format, dtcg, notes } = await client.call("tokens_read", { file, format: "dtcg", used: false });
    const { tokens } = await client.call("tokens_read", { file, format: "json", used: false });
    const modes = zod
      .parse(TokensSchema, tokens)
      .collections.reduce((sum, collection) => sum + collection.modes.length, 0);
    const trees = dtcg as Record<string, object>;
    const keys = Object.keys(trees);
    // One mode of each collection and the styles: the token files of one theme, the others' aliases left unresolved.
    const theme = keys.filter(
      (key, index) => keys.findIndex((other) => other.split(".")[0] === key.split(".")[0]) === index,
    );

    expect(format).toBe("dtcg");
    expect(keys).toHaveLength(modes + 1);
    expect(keys.at(-1)).toBe("styles");
    // Orbit's Label is uppercase: DTCG's typography has no case, so a note names it.
    expect(JSON.stringify(notes)).toContain("Label (text-transform)");
    expect(JSON.stringify(trees)).toMatch(
      /"\$type":"color","\$value":\{"colorSpace":"(srgb|display-p3)","components":\[/,
    );
    await expect(
      parse(
        theme.map((key) => ({ filename: new URL(`file:///${key}.json`), src: JSON.stringify(trees[key]) })),
        { config: defineConfig({}, { cwd: new URL(import.meta.url) }), resolveAliases: false },
      ),
    ).resolves.toMatchObject({ tokens: expect.any(Object) });
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

  it("finds the text style a part token tokens_read writes names: --Label-text-transform is Label's (D-20)", async () => {
    const { kind, name } = await client.call("tokens_usage", { file, token: "--Label-text-transform", within: "file" });

    expect({ kind, name }).toEqual({ kind: "text style", name: "Label" });
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

  // The answer key: Pricing – Desktop's colours bound to no style and no variable, by plugin code.
  it("lists the raw colours inside Pricing – Desktop with the layers using each, the bound stroke of 54:244 left out", async () => {
    const { colors } = await client.call("tokens_usage", { file, raw: true, within: pricingDesktop });
    const uses = (colors as { color: string; count: number; layers: { id: string }[] }[]).flatMap(({ color, layers }) =>
      layers.map(({ id }) => `${color} ${id}`),
    );

    expect(uses.sort()).toEqual(["#000000 54:455", "#B5B9C4 54:316", "#E1E5EE 54:458", "#FF6B3D 54:457"]);
    expect(uses.some((use) => use.endsWith(planStarter))).toBe(false);
  });

  // RG-3 gap 6, with the truth from the Plugin API: local variables, their ids and their alias chains.
  describe("RG-3: a token by name, with its id and alias chain", () => {
    const TRUTH = `const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();
const byId = new Map(variables.map((variable) => [variable.id, variable]));
const defaultMode = new Map(collections.map((collection) => [collection.id, collection.defaultModeId]));
const chain = (variable, modeId) => {
  const links = [];
  for (let value = variable.valuesByMode[modeId]; value && value.type === "VARIABLE_ALIAS"; ) {
    const target = byId.get(value.id);
    if (!target) break;
    links.push(target.id);
    value = target.valuesByMode[defaultMode.get(target.variableCollectionId)];
  }
  return links;
};`;

    const model = async (args: Record<string, unknown>) =>
      zod.parse(
        TokensSchema,
        (await client.call("tokens_read", { file, format: "json", used: false, ...args })).tokens,
      );

    it("keeps the variables whose name has the text, in any case, each with its Figma id", async () => {
      const truth = (await run(`${TRUTH}
const word = variables[0].name.split("/").pop().slice(0, 4);
return { word, ids: variables.filter((variable) => variable.name.toLowerCase().includes(word.toLowerCase())).map((variable) => variable.id) };`)) as {
        word: string;
        ids: string[];
      };
      const read = await model({ query: truth.word.toUpperCase() });

      expect(truth.ids.length).toBeGreaterThan(0);
      expect(read.collections.flatMap(({ variables }) => variables.map(({ id }) => id)).sort()).toEqual(
        truth.ids.sort(),
      );
    });

    it("gives a variable that aliases another its chain down to the one holding the value", async () => {
      const truth = (await run(`${TRUTH}
const aliased = variables.map((variable) => ({ variable, links: chain(variable, defaultMode.get(variable.variableCollectionId)) })).find(({ links }) => links.length > 0);
const collection = collections.find(({ id }) => id === aliased.variable.variableCollectionId);
return { id: aliased.variable.id, name: aliased.variable.name, mode: collection.modes.find(({ modeId }) => modeId === collection.defaultModeId).name, links: aliased.links, final: byId.get(aliased.links.at(-1)).name };`)) as {
        id: string;
        name: string;
        mode: string;
        links: string[];
        final: string;
      };
      const read = await model({ query: [truth.name] });
      const variable = read.collections.flatMap(({ variables }) => variables).find(({ id }) => id === truth.id);

      expect(variable?.aliasOf?.[truth.mode]).toHaveLength(truth.links.length);

      const everything = (await model({})).collections.flatMap(({ variables }) => variables);
      const last = variable?.aliasOf?.[truth.mode]?.at(-1);

      expect(everything.find(({ token }) => token === last)?.name).toBe(truth.final);
    });
  });
});
