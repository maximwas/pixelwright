import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const PREFIX = "live:design-apply-geometry:";

type Planned = {
  dry?: boolean;
  elements: { id: string | null }[];
  errors: { id?: string; attribute?: string; message: string; hint?: string }[];
  changes: { id: string | null; kind: string; props: Record<string, unknown>; sources: Record<string, string> }[];
};

// Dry runs only (the plan is read, nothing is written); the layers they plan against are made in the scratch Section by
// execute, named live:design-apply-geometry:<case>, and removed after.
describe("write/design_apply geometry and appearance planning", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const plan = async (xml: string): Promise<Planned> =>
    (await client.call("design_apply", { file, xml, dryRun: true })) as Planned;

  /** A layer made in the scratch Section by code that ends with `return node.id`. */
  const make = async (name: string, build: string): Promise<string> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const node = figma.createFrame();
node.name = ${JSON.stringify(PREFIX + name)};
section.appendChild(node);
${build}
return node.id;`)) as string;

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

  // Try it: a dry run on a real layer lists its width and opacity and writes nothing.
  it("lists the width and opacity that differ on the Install card and writes nothing", async () => {
    const before = await client.texts("design_read", { file, node: TEST_MCP.ids.install });
    const planned = await plan(`<Frame id="${TEST_MCP.ids.install}" width="400" opacity="0.5"/>`);
    const after = await client.texts("design_read", { file, node: TEST_MCP.ids.install });

    expect(planned.dry).toBe(true);
    expect(planned.errors).toEqual([]);
    expect(planned.changes[0]?.props).toMatchObject({ width: 400, opacity: 0.5 });
    expect(after).toEqual(before);
  });

  // Try it, C-055: Figma has no grow weights.
  it("refuses flex=2 on the Install card", async () => {
    const planned = await plan(`<Frame id="${TEST_MCP.ids.install}" flex="2"/>`);

    expect(planned.errors.map(({ message }) => message)).toEqual([
      expect.stringContaining("Figma has no grow weights"),
    ]);
  });

  // C-051: in the Section nothing lays the layer out, so its edges place it; a new right edge unpins the left one.
  it("plans a new right edge that unpins the left one", async () => {
    const id = await make("edges", `node.x = 10; node.y = 10;`);
    const [change] = (await plan(`<Frame id="${id}" right="0"/>`)).changes;

    expect(change?.props.horizontal).toEqual({ kind: "MAX", offset: 0 });
    expect(change?.sources.horizontal).toBe("right");
  });

  // C-051: a layer that flows in its auto layout parent is not placed by edges; the hint says how.
  it("refuses left on a layer in auto layout, with a hint", async () => {
    const parent = await make("flow", `node.layoutMode = "HORIZONTAL"; node.appendChild(figma.createFrame());`);
    const child = (await run(`const parent = await figma.getNodeByIdAsync(${JSON.stringify(parent)});
return parent.children[0].id;`)) as string;
    const planned = await plan(`<Frame id="${parent}"><Frame id="${child}" left="4px"/></Frame>`);

    expect(planned.errors).toMatchObject([{ id: child, attribute: "left", hint: expect.stringContaining("position") }]);
  });
});
