import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const PREFIX = "live:apply-layout:";

type Applied = {
  created: { line: number; ref: string; tag: string; id?: string }[];
  changed: string[];
  errors: { line: number; attribute?: string; message: string }[];
};

// design_apply's layout and geometry writes (item 39), on layers made in the scratch Section (copies by execute, or
// made by design_apply), named live:apply-layout:<case> and removed after.
describe("write/design_apply edits layout and geometry in Figma", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, ...more })) as Applied;
  /** New layers in the scratch Section; their ids in document order. */
  const make = async (xml: string): Promise<string[]> => {
    const applied = await apply(xml, { parent: scratch });

    expect(applied.errors).toEqual([]);

    return applied.created.map(({ id }) => id ?? "");
  };
  /** Fields of a layer, read by an expression over `node`. */
  const read = async (id: string, fields: string): Promise<Record<string, unknown>> =>
    (await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return ${fields};`)) as Record<string, unknown>;
  const centre = (id: string) =>
    read(
      id,
      "{ x: Math.round((node.absoluteBoundingBox.x + node.absoluteBoundingBox.width / 2) * 100) / 100, y: Math.round((node.absoluteBoundingBox.y + node.absoluteBoundingBox.height / 2) * 100) / 100 }",
    );

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

  // Try it, P-154 (layout part): an auto layout copy takes a new padding and gap; nothing else about it changes.
  it("changes the padding and gap of a copy and nothing else", async () => {
    const copy = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const copy = (await pw.node(${JSON.stringify(TEST_MCP.ids.install)})).clone();
copy.name = ${JSON.stringify(`${PREFIX}padding`)};
section.appendChild(copy);
return copy.id;`)) as string;
    const kept =
      "{ layoutMode: node.layoutMode, horizontal: node.layoutSizingHorizontal, vertical: node.layoutSizingVertical, width: node.width, fills: node.fills.length, radius: node.cornerRadius, opacity: node.opacity, rotation: node.rotation, children: node.children.map((child) => [child.name, child.layoutSizingHorizontal, child.layoutSizingVertical]) }";
    const before = await read(copy, kept);
    const applied = await apply(`<Frame id="${copy}" padding="40px" gap="12px"/>`);

    expect(applied.errors).toEqual([]);
    expect(applied.changed).toEqual([copy]);
    expect(
      await read(copy, "[node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft, node.itemSpacing]"),
    ).toEqual([40, 40, 40, 40, 12]);
    expect(await read(copy, kept)).toEqual(before);
  });

  // FX-041, P-150: resize() fixes both axes; a hugging parent keeps hugging its height and its FILL child keeps filling.
  it("keeps a FILL child filling and a hugging height after a width or height changes", async () => {
    const [parent = "", child = ""] = await make(
      `<Frame name="${PREFIX}fill" display="flex" width="300" padding="10px"><Rectangle name="${PREFIX}fill-child" flex="1" height="20"/></Frame>`,
    );

    await apply(`<Frame id="${parent}" width="420"/>`);
    await apply(`<Rectangle id="${child}" height="30"/>`);

    expect(await read(parent, "[node.layoutSizingHorizontal, node.layoutSizingVertical, node.width]")).toEqual([
      "FIXED",
      "HUG",
      420,
    ]);
    expect(await read(child, "[node.layoutSizingHorizontal, node.width, node.height]")).toEqual(["FILL", 400, 30]);
  });

  // B-047: Figma makes a new text 0 wide and leaves it so when it fills; it is laid out to the row's width.
  it("lays a new filling Text out to its row's width", async () => {
    const [, text = ""] = await make(
      `<Frame name="${PREFIX}text" display="flex" width="300"><Text name="${PREFIX}text-fill" flex="1">Hello there</Text></Frame>`,
    );

    expect(await read(text, "[node.layoutSizingHorizontal, node.width]")).toEqual(["FILL", 300]);
  });

  // P-150: a Section has only resizeWithoutConstraints.
  it("resizes a Section", async () => {
    const [section = ""] = await make(`<Section name="${PREFIX}section" width="200" height="100"/>`);
    const applied = await apply(`<Section id="${section}" width="320" height="240"/>`);

    expect(applied.errors).toEqual([]);
    expect(await read(section, "[node.width, node.height]")).toEqual([320, 240]);
  });

  // P-151: a turn is about the layer's centre, as CSS turns.
  it("turns a layer about its centre", async () => {
    const [, box = ""] = await make(
      `<Frame name="${PREFIX}turn" width="300" height="300"><Rectangle name="${PREFIX}turn-box" position="absolute" left="50" top="60" width="100" height="40" background="#3366ff"/></Frame>`,
    );
    const before = await centre(box);
    const applied = await apply(`<Rectangle id="${box}" transform="rotate(30deg)"/>`);

    expect(applied.errors).toEqual([]);
    expect(await read(box, "Math.round(node.rotation)")).toBe(-30);
    expect(await centre(box)).toEqual(before);
  });

  // P-151: an absolute layer is placed by its edges, and keeps the constraint it was read from.
  it("places an absolute layer by its right and bottom edges", async () => {
    const [, box = ""] = await make(
      `<Frame name="${PREFIX}place" width="300" height="200"><Rectangle name="${PREFIX}place-box" position="absolute" left="0" top="0" width="40" height="20"/></Frame>`,
    );
    const applied = await apply(`<Rectangle id="${box}" position="absolute" right="10" bottom="30"/>`);

    expect(applied.errors).toEqual([]);
    expect(await read(box, "[node.x, node.y, node.constraints.horizontal, node.constraints.vertical]")).toEqual([
      250,
      150,
      "MAX",
      "MAX",
    ]);
  });

  // FX-036: shrinking a frame by its width does not scale the children its constraints would scale.
  it("shrinks a frame without squashing its SCALE-constrained children", async () => {
    const [frame = "", box = ""] = await make(
      `<Frame name="${PREFIX}scale" width="200" height="200"><Rectangle name="${PREFIX}scale-box" position="absolute" left="0" top="0" width="100" height="100"/></Frame>`,
    );

    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(box)});
node.constraints = { horizontal: "SCALE", vertical: "SCALE" };`);
    await apply(`<Frame id="${frame}" width="120"/>`);

    expect(await read(frame, "node.width")).toBe(120);
    expect(await read(box, "[node.width, node.height]")).toEqual([100, 100]);
  });
});
