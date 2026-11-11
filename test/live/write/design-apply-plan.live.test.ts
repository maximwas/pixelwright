import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const PREFIX = "live:design-apply-plan:";

type Planned = {
  dry?: boolean;
  elements: { id: string | null }[];
  errors: { id?: string; message: string }[];
  changes: { id: string | null; kind: string; props: Record<string, unknown>; sources: Record<string, string> }[];
};

// Dry runs only (the plan is read, nothing is written); the layers they plan against are made in the scratch Section by
// execute, named live:design-apply-plan:<case>, and removed after.
describe("write/design_apply planning", () => {
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

  // Try it: a dry run on a real layer lists its layout changes and writes nothing.
  it("lists the padding and gap that differ on the Install card and writes nothing", async () => {
    const before = await client.texts("design_read", { file, node: TEST_MCP.ids.install });
    const planned = await plan(`<Frame id="${TEST_MCP.ids.install}" padding="31px" gap="13px"/>`);
    const after = await client.texts("design_read", { file, node: TEST_MCP.ids.install });

    expect(planned.dry).toBe(true);
    expect(planned.errors).toEqual([]);
    expect(planned.changes.map(({ id, kind }) => [id, kind])).toEqual([[TEST_MCP.ids.install, "update"]]);
    expect(Object.values(planned.changes[0]?.sources ?? {}).sort()).toEqual(expect.arrayContaining(["gap", "padding"]));
    expect(after).toEqual(before);
  });

  // C-034, O-017: the gap shorthand resets the row and column gaps the layer has.
  it("plans a gap over the row and column gaps a wrapping layer has", async () => {
    const id = await make(
      "gap",
      `node.layoutMode = "HORIZONTAL"; node.layoutWrap = "WRAP"; node.itemSpacing = 8; node.counterAxisSpacing = 4;
for (let index = 0; index < 2; index++) node.appendChild(figma.createRectangle());`,
    );
    const [change] = (await plan(`<Frame id="${id}" gap="12px"/>`)).changes;

    expect(change?.props).toMatchObject({ itemSpacing: 12, counterAxisSpacing: 12 });
  });

  // B-049, C-037: a grid's tracks are not sent again when the call does not change them.
  it("leaves a grid's tracks out when only its gap changes", async () => {
    const id = await make(
      "grid",
      `node.layoutMode = "GRID"; node.gridColumnCount = 2; node.gridRowCount = 2;
for (let index = 0; index < 3; index++) node.appendChild(figma.createRectangle());`,
    );
    const [change] = (await plan(`<Frame id="${id}" gap="9px"/>`)).changes;

    expect(change?.props).toMatchObject({ gridColumnGap: 9, gridRowGap: 9 });
    expect(change?.props).not.toHaveProperty("gridColumns");
    expect(change?.props).not.toHaveProperty("gridRows");
  });

  // O-033: padding-top alone keeps the other sides the layer has.
  it("plans padding-top alone over the other sides", async () => {
    const id = await make(
      "padding",
      `node.layoutMode = "VERTICAL"; node.paddingLeft = 20; node.paddingRight = 20; node.paddingBottom = 10;`,
    );
    const [change] = (await plan(`<Frame id="${id}" padding-top="5px"/>`)).changes;

    expect(change?.props.padding).toEqual([5, 20, 10, 20]);
  });

  // P-118: the apply profile reads the outermost named layers; a nested named layer is found inside, an id the file
  // lacks goes on to the plugin, and neither is a refusal.
  it("plans nested named layers from the outermost read and lets an unknown id through", async () => {
    const outer = await make("outer", `node.layoutMode = "VERTICAL"; node.itemSpacing = 1;`);
    const inner = (await run(`const outer = await figma.getNodeByIdAsync(${JSON.stringify(outer)});
const inner = figma.createFrame();
inner.name = ${JSON.stringify(`${PREFIX}inner`)};
inner.layoutMode = "HORIZONTAL";
inner.itemSpacing = 2;
outer.appendChild(inner);
return inner.id;`)) as string;
    const planned = await plan(
      `<Frame id="${outer}" gap="5px"><Frame id="${inner}" gap="7px"/></Frame><Frame id="999999:1" padding="4px"/>`,
    );

    expect(planned.errors).toEqual([]);
    expect(planned.changes.map(({ id }) => id)).toEqual([outer, inner, "999999:1"]);
  });
});
