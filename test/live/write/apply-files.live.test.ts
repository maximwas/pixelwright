import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "fast-png";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:apply-files:";

/** The collection this file sets a mode of: Test MCP's Starter plan gives a collection one mode. */
const COLLECTION = "pwlivetheme";

/** The annotation category the note case files under; made here only when the file has none of that name. */
const CATEGORY = "Interaction";

const folder = mkdtempSync(join(tmpdir(), "pw-apply-files-"));

function file(name: string, bytes: Uint8Array | string): string {
  const path = join(folder, name);

  writeFileSync(path, bytes);

  return path;
}

function png(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4).fill(180);

  return encode({ width, height, channels: 4, depth: 8, data });
}

const photo = png(24, 16);
const photoPath = file("photo.png", photo);
const widePath = file("wide.png", png(4100, 1));
const circle = file(
  "circle.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#333"/></svg>',
);
const square = file(
  "square.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="20" height="20" fill="#333"/></svg>',
);

type Applied = {
  created: { id?: string }[];
  changed: string[];
  errors: { attribute?: string; message: string; hint?: string }[];
};

// design_apply's files, modes and notes (item 42) in the Live tests Section, every layer named
// live:apply-files:<case> and removed after; the mode collection and a category made here are removed too.
describe("write/design_apply images, icons, modes and notes", () => {
  const { file: figmaFile, scratch } = inject("live");
  let client: LiveClient;
  let madeCategory = false;

  const run = async (code: string): Promise<unknown> =>
    (await client.call("execute", { file: figmaFile, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file: figmaFile, xml, parent: scratch, ...more })) as Applied;
  const frame = async (name: string): Promise<string> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(PREFIX + name)};
frame.resize(200, 100);
section.appendChild(frame);
return frame.id;`)) as string;
  const node = async (id: string, fields: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return JSON.parse(JSON.stringify(${fields}));`);
  const removeCollection = `for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
  if (collection.name === ${JSON.stringify(COLLECTION)}) collection.remove();
}`;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
    madeCategory = (await run(`const categories = await figma.annotations.getAnnotationCategoriesAsync();
if (categories.some(({ label }) => label === ${JSON.stringify(CATEGORY)})) return false;
await figma.annotations.addAnnotationCategoryAsync({ label: ${JSON.stringify(CATEGORY)}, color: "blue" });
return true;`)) as boolean;
  });

  afterAll(async () => {
    if (client === undefined) {
      return;
    }

    try {
      await run(`${removeCollection}
if (${madeCategory}) {
  for (const category of await figma.annotations.getAnnotationCategoriesAsync()) {
    if (category.label === ${JSON.stringify(CATEGORY)}) category.remove();
  }
}`);
    } finally {
      try {
        await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
      } finally {
        await client.close();
      }
    }
  });

  // Try it, T-131, FX-055: the image is made of the PNG's bytes, its hash their SHA-1.
  it("creates an Image from a PNG, filled with its picture", async () => {
    const applied = await apply(`<Image name="${PREFIX}photo" src="${photoPath}" width="240" height="160"/>`);
    const id = applied.created[0]?.id ?? "";

    expect(applied.errors).toEqual([]);
    expect(await node(id, "{ width: node.width, fill: node.fills[0] }")).toMatchObject({
      width: 240,
      fill: { type: "IMAGE", imageHash: createHash("sha1").update(photo).digest("hex") },
    });
  });

  // FX-055: Figma takes images up to 4096 px a side; the server refuses past it, and nothing is made.
  it("refuses a 4100 px image on its src and makes no layer", async () => {
    const applied = await apply(`<Image name="${PREFIX}wide" src="${widePath}" width="410" height="10"/>`);

    expect(applied.created).toEqual([]);
    expect(applied.errors).toEqual([
      expect.objectContaining({ attribute: "src", message: expect.stringContaining("is 4100×1 px") }),
    ]);
  });

  // T-133: an existing Icon is never redrawn from another file.
  it("refuses another src on an existing Icon: delete the icon and create it again", async () => {
    const made = await apply(`<Icon name="${PREFIX}icon" src="${circle}" width="48"/>`);
    const id = made.created[0]?.id ?? "";

    expect(made.errors).toEqual([]);
    expect(await node(id, "{ width: node.width }")).toEqual({ width: 48 });

    const redrawn = await apply(`<Icon id="${id}" src="${square}"/>`);

    expect(redrawn.errors).toEqual([
      expect.objectContaining({
        attribute: "src",
        message: expect.stringContaining("delete the icon and create it again"),
      }),
    ]);
  });

  // T-139, B-017: a prefix is a category only when the file has it; the same note sent back writes nothing.
  it("files a note under the file's category and writes nothing when it comes back unchanged", async () => {
    const id = await frame("note");
    const note = `${CATEGORY}: opens the menu`;
    const applied = await apply(`<Frame id="${id}" note="${note}"/>`);
    const written = (await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
const categories = await figma.annotations.getAnnotationCategoriesAsync();
return node.annotations.map(({ label, categoryId }) => ({
  label,
  category: categories.find((category) => category.id === categoryId)?.label,
}));`)) as unknown;
    const again = await apply(`<Frame id="${id}" note="${note}"/>`);

    expect(applied.errors).toEqual([]);
    expect(written).toEqual([{ label: "opens the menu", category: CATEGORY }]);
    expect(again.changed).toEqual([]);
  });

  // C-135: data-<collection>="<mode>" sets the layer's mode; an empty one clears it.
  it("sets the collection's only mode and clears it again", async () => {
    const collection = (await run(`${removeCollection}
const collection = figma.variables.createVariableCollection(${JSON.stringify(COLLECTION)});
return collection.id;`)) as string;
    const id = await frame("mode");
    const set = await apply(`<Frame id="${id}" data-${COLLECTION}="mode-1"/>`);
    const explicit = async () => await node(id, "node.explicitVariableModes");

    expect(set.errors).toEqual([]);
    expect(Object.keys((await explicit()) as object)).toEqual([collection]);

    const cleared = await apply(`<Frame id="${id}" data-${COLLECTION}=""/>`);

    expect(cleared.errors).toEqual([]);
    expect(await explicit()).toEqual({});
  });
});
