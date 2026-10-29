import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

/**
 * The drift check (C-191, K-084): each Orbit fixture's root read live in Test MCP writes what its 0.7.0 golden holds,
 * element by element and attribute by attribute. Attributes the golden has none of on an element (fields 0.7.0 did
 * not read: dev status, interactions, export settings) are left out. A drift is reported for review, never
 * a silent fixture or golden update.
 */
const FIXTURES = [
  { name: "customers", node: "54:434" },
  { name: "desktop-top", node: "54:227", depth: 1 },
  { name: "plans", node: "54:243" },
  { name: "pricing", node: "54:227" },
] as const;

/** Each element's attributes by its id, its tag as `<tag>`: one element per line. */
function elements(xml: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();

  for (const line of xml.split("\n")) {
    const attributes = new Map(
      [...line.matchAll(/\s([\w$:-]+)="([^"]*)"/g)].map(([, name = "", value = ""]) => [name, value]),
    );
    const id = attributes.get("id");

    if (id !== undefined) {
      found.set(id, attributes.set("<tag>", /<(\w+)/.exec(line)?.[1] ?? ""));
    }
  }

  return found;
}

describe("read/read-model", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it.each(FIXTURES)("reads Orbit's $name root live as its fixture (no drift)", async ({ name, node, ...depth }) => {
    const golden = elements(
      readFileSync(new URL(`../../golden/__golden__/orbit-${name}.xml`, import.meta.url), "utf8"),
    );
    const [xml = ""] = await client.texts("design_read", { file, node, ...depth });
    const live = elements(xml);
    const drift = [...golden].flatMap(([id, expected]) => {
      const actual = live.get(id);

      return actual === undefined
        ? [`${id}: not read live`]
        : [...expected]
          .filter(([attribute, value]) => actual.get(attribute) !== value)
          .map(([attribute, value]) => `${id} ${attribute}: fixture ${value}, live ${actual.get(attribute) ?? "-"}`);
    });

    expect(drift).toEqual([]);
    expect([...live.keys()].sort()).toEqual([...golden.keys()].sort());
  });
});
