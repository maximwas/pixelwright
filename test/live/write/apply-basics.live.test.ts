import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const PREFIX = "live:apply-basics:";

type Applied = {
  dry?: boolean;
  created: { line: number; ref: string; tag: string; id?: string; name?: string }[];
  changed: string[];
  errors: { line: number; column: number; id?: string; attribute?: string; message: string; hint?: string }[];
};

// design_apply's real writes (item 38): every layer is made in the scratch Section, named live:apply-basics:<case>, and
// removed after.
describe("write/design_apply creates layers in Figma", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, parent: scratch, ...more })) as Applied;
  /** The names of the scratch Section's layers that start with the prefix and the case. */
  const named = async (name: string): Promise<string[]> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
return section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX + name)})).map((node) => node.name);`)) as string[];
  const frame = (name: string) =>
    `<Frame name="${PREFIX}${name}" width="200" height="120" display="flex" padding="16px"><Text name="${PREFIX}${name}-text">Hello</Text><Rectangle name="${PREFIX}${name}-box" width="20" height="20"/></Frame>`;
  const placed = ({ created }: Applied) => created.map(({ line, ref, tag }) => ({ line, ref, tag }));

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

  // Try it, T-120, T-123: the frame with its children in the parent given; new layers start bare.
  it("creates a Frame with its children in the scratch Section", async () => {
    const applied = await apply(frame("frame"));

    expect(applied.errors).toEqual([]);
    expect(applied.created.map(({ tag }) => tag)).toEqual(["Frame", "Text", "Rectangle"]);

    const made = await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(applied.created[0]?.id)});
return { parent: node.parent.id, layoutMode: node.layoutMode, padding: node.paddingLeft, width: node.width,
  height: node.height, fills: node.fills.length, children: node.children.map((child) => child.name),
  text: node.children[0].characters };`);

    expect(made).toEqual({
      parent: scratch,
      layoutMode: "HORIZONTAL",
      padding: 16,
      width: 200,
      height: 120,
      fills: 0,
      children: [`${PREFIX}frame-text`, `${PREFIX}frame-box`],
      text: "Hello",
    });
  });

  // Try it, T-012: a dry run runs the same checks in the plugin and lists the same created, without ids.
  it("creates nothing on a dry run of the same XML and lists the same created", async () => {
    const dry = await apply(frame("dry"), { dryRun: true });

    expect(dry.dry).toBe(true);
    expect(await named("dry")).toEqual([]);

    const real = await apply(frame("dry"));

    expect(placed(dry)).toEqual(placed(real));
    expect(dry.created.every(({ id }) => id === undefined)).toBe(true);
  });

  // T-122: a read sent back unchanged changes nothing.
  it("changes nothing when a read of an execute-made copy is sent back", async () => {
    const copy = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const copy = (await pw.node(${JSON.stringify(TEST_MCP.ids.install)})).clone();
copy.name = ${JSON.stringify(`${PREFIX}copy`)};
section.appendChild(copy);
return copy.id;`)) as string;
    const read = await client.texts("design_read", { file, node: copy });
    const applied = (await client.call("design_apply", { file, xml: read[0] ?? "" })) as Applied;

    expect(applied).toMatchObject({ created: [], changed: [], errors: [] });
    expect(await client.texts("design_read", { file, node: copy })).toEqual(read);
  });

  // T-121: the whole call is one undo step.
  it("undoes three new layers with one figma.triggerUndo()", async () => {
    const applied = await apply(
      ["a", "b", "c"].map((name) => `<Rectangle name="${PREFIX}undo-${name}" width="10" height="10"/>`).join(""),
    );

    expect(applied.created).toHaveLength(3);
    expect(await named("undo")).toHaveLength(3);
    await run("figma.triggerUndo();");
    expect(await named("undo")).toEqual([]);
  });

  // T-121: each element is written on its own; the error carries its line and column.
  it("writes the other elements when one fails, with the line and column of the one that did", async () => {
    const applied = await apply(
      `<Rectangle name="${PREFIX}each-a" width="10" height="10"/>\n  <Frame id="999999:1" padding="4px"/>\n<Ellipse name="${PREFIX}each-b" width="10" height="10"/>`,
    );

    expect(applied.created.map(({ tag }) => tag)).toEqual(["Rectangle", "Ellipse"]);
    expect(applied.errors).toMatchObject([{ line: 2, column: 3, id: "999999:1" }]);
    expect(await named("each")).toEqual([`${PREFIX}each-a`, `${PREFIX}each-b`]);
  });

  // P-079: capabilities by type; each layer is made, what its type cannot take refused on its attribute. Reading
  // refuses a Line's background first (item 33); the plugin's table refuses a Section's opacity.
  it("refuses a fill on a Line and opacity on a Section by their capabilities", async () => {
    const applied = await apply(
      `<Line name="${PREFIX}line" background="#ff0000"/><Section name="${PREFIX}section" opacity="0.5"/>`,
    );

    expect(applied.errors).toMatchObject([
      { attribute: "background", message: "A <Line> has no background." },
      { attribute: "opacity", message: "A section has no opacity." },
    ]);
    expect(applied.created.map(({ tag }) => tag)).toEqual(["Line", "Section"]);
  });
});
