import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

/** Every custom property the CSS declares, and every one its values name in var(). */
const declared = (css: string): Set<string> =>
  new Set([...css.matchAll(/^\s*(--[^:\s]+):/gm)].map(([, name]) => name ?? ""));

// Comments left out: the text styles' heading shows the use, `font: var(--name-font)`, with no such token.
const referenced = (css: string): Set<string> =>
  new Set([...css.replaceAll(/\/\*[\s\S]*?\*\//g, "").matchAll(/var\((--[^),\s]+)/g)].map(([, name]) => name ?? ""));

// It only reads: nothing to clean up, and a failed case may run again.
describe("read/tokens", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

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
});
