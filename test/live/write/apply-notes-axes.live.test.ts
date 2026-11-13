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

    // Figma's own order of the axes is no contract: they are compared sorted.
    const written = (/font-variation-settings="([^"]*)"/.exec(xml)?.[1] ?? "").split(", ").sort();

    // Figma stores every axis of the family once one is set (the rest at their defaults), and design_read writes what
    // Figma holds: the axes written are there with their values, and the whole read sent back changes nothing.
    expect(written).toEqual(expect.arrayContaining(["'GRAD' 50", "'wdth' 90"]));
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
      // A pin needs what it pins: Figma throws for a background on a frame with no fill, so this frame has one.
      `<Frame name="${PREFIX}notes" display="flex" gap="8px" padding="16px" width="200px" height="100px" background="#eeeeee" note="Gap is 8 [gap, padding] | [background]"/>`,
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

  // NEW-090 live probe: Figma throws "Invalid property fills for a FRAME node" for a pin the layer cannot hold, so
  // design_apply refuses it first, alike on dry and real runs, and writes the note once the same call gives the layer it.
  it("refuses a pin the layer cannot hold on dry and real runs alike, and holds one the same call gives it", async () => {
    const bare = `<Frame name="${PREFIX}pin-refused" width="100px" height="50px" note="Fill [background] | Gap [gap]"/>`;
    const [dry, real] = [await apply(bare, true), await apply(bare)];

    expect(dry.errors).toMatchObject([
      { attribute: "note", message: "A note pins background, but this frame has no fill." },
    ]);
    expect(real.errors).toEqual(dry.errors);

    const given = `<Frame name="${PREFIX}pin-given" display="flex" gap="8px" width="100px" height="50px" background="#eeeeee" note="Fill [background] | Gap [gap]"/>`;

    expect((await apply(given, true)).errors).toEqual([]);
    expect((await apply(given)).errors).toEqual([]);
  });
});
