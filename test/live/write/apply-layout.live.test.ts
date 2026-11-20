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

  // P-150: a frame is resized as in Figma, so the children its constraints tie to its edges follow it.
  it("widens a frame with its STRETCH child and keeps a right-pinned child on the right edge", async () => {
    const [frame = "", wide = "", pinned = ""] = await make(
      `<Frame name="${PREFIX}follow" width="200" height="100"><Rectangle name="${PREFIX}follow-wide" position="absolute" left="10" top="10" width="180" height="20"/><Rectangle name="${PREFIX}follow-pinned" position="absolute" left="150" top="50" width="40" height="20"/></Frame>`,
    );

    await run(`(await figma.getNodeByIdAsync(${JSON.stringify(wide)})).constraints = { horizontal: "STRETCH", vertical: "MIN" };
(await figma.getNodeByIdAsync(${JSON.stringify(pinned)})).constraints = { horizontal: "MAX", vertical: "MIN" };`);

    const applied = await apply(`<Frame id="${frame}" width="300"/>`);

    expect(applied.errors).toEqual([]);
    expect(await read(frame, "node.width")).toBe(300);
    expect(await read(wide, "[node.x, node.width]")).toEqual([10, 280]);
    expect(await read(pinned, "[node.x, node.width]")).toEqual([250, 40]);
  });

  // FX-036: the parent's size goes in before its children's, so a constrained child sized in the same call keeps that
  // size. A SCALE child's pixel size is refused by the read rules (its edges read in percents), so a STRETCH child,
  // which a resize would also change, stands for it.
  it("shrinks a frame and gives its STRETCH child the size written in the same call", async () => {
    const [frame = "", box = ""] = await make(
      `<Frame name="${PREFIX}scale" width="200" height="200"><Rectangle name="${PREFIX}scale-box" position="absolute" left="0" top="0" width="100" height="100"/></Frame>`,
    );

    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(box)});
node.constraints = { horizontal: "STRETCH", vertical: "MIN" };`);

    const applied = await apply(`<Frame id="${frame}" width="120"><Rectangle id="${box}" width="80"/></Frame>`);

    expect(applied.errors).toEqual([]);
    expect(await read(frame, "node.width")).toBe(120);
    expect(await read(box, "[node.width, node.height]")).toEqual([80, 100]);
  });

  // FX-059: a grid child moves to a cell and aligns in it; a cell outside the grid is refused on grid-row.
  it("moves a grid child to a cell, aligns it to the end and refuses a cell outside the grid", async () => {
    const [grid = "", first = "", second = ""] = await make(
      `<Frame name="${PREFIX}grid" width="200" height="100"><Rectangle name="${PREFIX}grid-first" width="40" height="20"/><Rectangle name="${PREFIX}grid-second" width="40" height="20"/></Frame>`,
    );

    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(grid)});
node.layoutMode = "GRID"; node.gridColumnCount = 2; node.gridRowCount = 2;`);

    const moved = await apply(`<Rectangle id="${first}" grid-row="2" grid-column="2" align-self="end"/>`);

    expect(moved.errors).toEqual([]);
    expect(
      await read(first, "[node.gridRowAnchorIndex, node.gridColumnAnchorIndex, node.gridChildVerticalAlign]"),
    ).toEqual([1, 1, "MAX"]);

    const outside = await apply(`<Rectangle id="${second}" grid-row="5" grid-column="1"/>`);

    expect(outside.errors).toEqual([
      expect.objectContaining({ attribute: "grid-row", message: expect.stringContaining("out of bounds of the grid") }),
    ]);
  });

  // P-150: a Line written by its height stands upright, as design_read writes a standing line.
  it("stands a Line upright when its height is written", async () => {
    const [line = ""] = await make(`<Line name="${PREFIX}line" width="100"/>`);
    const applied = await apply(`<Line id="${line}" height="80"/>`);

    expect(applied.errors).toEqual([]);
    expect(
      await read(line, "[node.width, Math.abs(Math.round(node.rotation)), node.absoluteBoundingBox.height]"),
    ).toEqual([80, 90, 80]);
  });
});

/** The scratch collection the token cases bind: live-gaps-space = 14, live-gaps-size = 120. Variables are not layers. */
const GAPS = "live:gaps";

const removeGaps = `for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
  if (collection.name === ${JSON.stringify(GAPS)}) collection.remove();
}`;

// T-135, C-181: var() of a number variable on a gap, a padding side, a size, a limit and a radius binds the variable;
// a number takes it off; what cannot bind is refused on its attribute by a dry run as by the real one.
describe("write/design_apply binds number variables to lengths", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  let space = "";
  let size = "";

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, ...more })) as Applied;
  const read = async (id: string, fields: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return JSON.parse(JSON.stringify(${fields}));`);

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
    ({ space, size } = (await run(`${removeGaps}
const collection = figma.variables.createVariableCollection(${JSON.stringify(GAPS)});
const space = figma.variables.createVariable("live-gaps-space", collection, "FLOAT");
const size = figma.variables.createVariable("live-gaps-size", collection, "FLOAT");
space.setValueForMode(collection.defaultModeId, 14);
size.setValueForMode(collection.defaultModeId, 120);
return { space: space.id, size: size.id };`)) as { space: string; size: string });
  });

  afterAll(async () => {
    if (client === undefined) {
      return;
    }

    try {
      await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.children.filter((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) node.remove();
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    } finally {
      try {
        await run(removeGaps);
      } finally {
        await client.close();
      }
    }
  });

  it("binds a gap, a padding side, a width, a min width and a radius, and a number takes the gap's off", async () => {
    const xml = `<Frame name="${PREFIX}tokens" display="flex" gap="var(--live-gaps-space)" padding="var(--live-gaps-space) 4px" width="var(--live-gaps-size)" min-width="var(--live-gaps-size)" border-radius="var(--live-gaps-space)"/>`;
    const dry = await apply(xml, { parent: scratch, dryRun: true });

    expect(dry.errors).toEqual([]);

    const made = await apply(xml, { parent: scratch });
    const frame = made.created[0]?.id ?? "";

    expect(made.errors).toEqual([]);
    expect(
      await read(
        frame,
        "[node.itemSpacing, node.paddingTop, node.paddingRight, node.width, node.minWidth, node.topLeftRadius, node.boundVariables.itemSpacing?.id, node.boundVariables.paddingTop?.id, node.boundVariables.paddingRight?.id, node.boundVariables.width?.id, node.boundVariables.minWidth?.id, node.boundVariables.topLeftRadius?.id]",
      ),
    ).toEqual([14, 14, 4, 120, 120, 14, space, space, null, size, size, space]);

    const unbound = await apply(`<Frame id="${frame}" gap="8px"/>`);

    expect(unbound.errors).toEqual([]);
    expect(await read(frame, "[node.itemSpacing, node.boundVariables.itemSpacing?.id ?? null]")).toEqual([8, null]);
  });

  it("refuses a var() that names no number variable on its attribute, on a dry run as on the real one", async () => {
    const xml = `<Frame name="${PREFIX}unknown" display="flex" gap="var(--live-gaps-nope)" width="40px"/>`;

    for (const dryRun of [true, false]) {
      const applied = await apply(xml, { parent: scratch, dryRun });

      expect(applied.errors, `dryRun ${dryRun}`).toEqual([
        expect.objectContaining({ attribute: "gap", message: expect.stringContaining("live-gaps-nope") }),
      ]);
    }

    const section = await apply(`<Section id="${scratch}" width="var(--live-gaps-size)"/>`, { dryRun: true });

    expect(section.errors).toEqual([
      expect.objectContaining({ message: "A section's size takes a number of pixels, not a token." }),
    ]);
  });
});
