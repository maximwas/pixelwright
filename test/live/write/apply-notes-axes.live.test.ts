import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:apply-notes-axes:";

type Applied = {
  created: { id?: string }[];
  changed: string[];
  errors: { id?: string; attribute?: string; message: string; hint?: string }[];
};

type Inspected = { layers: { notes?: { label?: string; category?: string; pins?: string[] }[] }[] };

// NEW-090: Dev Mode notes with their pins, and a variable font's axes, written by design_apply on layers execute makes
// in the Live tests Section, each named live:apply-notes-axes:<case> and removed after.
describe("write/design_apply notes with pins and font-variation-settings", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, dryRun = false): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, parent: scratch, dryRun })) as Applied;
  const read = async (id: string): Promise<string> => (await client.texts("design_read", { file, node: id }))[0] ?? "";
  const notes = async (id: string) =>
    ((await client.call("inspect", { file, nodes: [id], fields: ["notes"] })) as Inspected).layers[0]?.notes;
  /** A text in Roboto Flex Regular 16 (a variable family Figma serves, with wdth 25..151 and GRAD -200..150). */
  const flex = async (name: string): Promise<string> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Roboto Flex", style: "Regular" });
const node = figma.createText();
node.name = ${JSON.stringify(PREFIX + name)};
node.autoRename = false;
node.fontName = { family: "Roboto Flex", style: "Regular" };
node.characters = "Variable";
section.appendChild(node);
return node.id;`)) as string;
  const axes = async (id: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return node.fontName.variationSettings;`);

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    if (client === undefined) {
      return;
    }

    try {
      const left = await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of [...section.children]) {
  if (node.name.startsWith(${JSON.stringify(PREFIX)}) && !node.removed) node.remove();
}
return section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)})).length;`);

      expect(left).toBe(0);
    } finally {
      await client.close();
    }
  });

  // Plugin API 138: the axes go on the text, design_read writes them back, and its read sent back changes nothing.
  it("writes a variable font's axes, reads them back and writes nothing for its own read", async () => {
    const id = await flex("axes");
    const applied = await apply(`<Text id="${id}" font-variation-settings="'wdth' 90, 'GRAD' 50"/>`);

    expect(applied.errors).toEqual([]);
    expect(await axes(id)).toMatchObject({ wdth: 90, GRAD: 50, wght: 400 });

    const xml = await read(id);

    expect(xml).toContain(`font-variation-settings="'wdth' 90, 'GRAD' 50"`);
    expect(await apply(xml)).toMatchObject({ changed: [], errors: [] });
  });

  // Figma names Roboto Flex's axes; the catalogue gives their ranges: dry and real runs refuse alike.
  it("refuses an axis the family lacks and a value outside its range, on dry and real runs alike", async () => {
    const id = await flex("refused");
    const xml = `<Text id="${id}" font-variation-settings="'wdth' 200"/>`;
    const lacking = `<Text id="${id}" font-variation-settings="'ABCD' 1"/>`;
    const [dry, real] = [await apply(xml, true), await apply(xml)];

    expect(dry.errors).toMatchObject([
      { id, attribute: "font-variation-settings", message: "'wdth' 200 is outside Roboto Flex's range, 25 to 151." },
    ]);
    expect(real.errors).toEqual(dry.errors);
    expect((await apply(lacking, true)).errors[0]?.message).toMatch(/^Roboto Flex has no 'ABCD' axis: it has /);
    expect((await apply(lacking)).errors[0]?.message).toMatch(/^Roboto Flex has no 'ABCD' axis: it has /);
    expect(await axes(id)).toMatchObject({ wdth: 100 });
  });

  // NEW-090: a note's closing bracket pins properties; one of pins alone is a bracket; both read back as written.
  it("pins properties in notes, reads them back and removes a pin and a note of pins alone", async () => {
    const applied = await apply(
      `<Frame name="${PREFIX}notes" display="flex" gap="8px" padding="16px" width="200px" height="100px" note="Gap is 8 [gap, padding] | [background]"/>`,
    );
    const id = applied.created[0]?.id ?? "";

    expect(applied.errors).toEqual([]);
    expect(await notes(id)).toEqual([{ label: "Gap is 8", pins: ["itemSpacing", "padding"] }, { pins: ["fills"] }]);

    const xml = await read(id);

    expect(xml).toContain(`note="Gap is 8 [gap, padding] | [background]"`);
    expect(await apply(xml)).toMatchObject({ changed: [], errors: [] });
    expect(await apply(`<Frame id="${id}" note="Gap is 8"/>`)).toMatchObject({ changed: [id], errors: [] });
    expect(await notes(id)).toEqual([{ label: "Gap is 8" }]);
  });
});
