import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:apply-text:";

/** The arc a label is made along in these cases: one curve over a 200 px span. */
const ARC = "M 0 50 C 55.23 -16.67 144.77 -16.67 200 50";

type Applied = {
  created: { id?: string }[];
  changed: string[];
  errors: { id?: string; attribute?: string; message: string; hint?: string }[];
};

// design_apply's text writing (item 43) on texts execute makes in the Live tests Section, each named
// live:apply-text:<case> and removed after.
describe("write/design_apply text, fonts and TextPath", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, dryRun = false): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, parent: scratch, dryRun })) as Applied;
  /** A text in Inter Regular 16 with these characters; `bold` runs from..to in Inter Bold. */
  const text = async (
    name: string,
    characters: string,
    bold?: readonly [number, number],
  ): Promise<string> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
const node = figma.createText();
node.name = ${JSON.stringify(PREFIX + name)};
node.autoRename = false;
node.characters = ${JSON.stringify(characters)};
${bold === undefined ? "" : `node.setRangeFontName(${bold[0]}, ${bold[1]}, { family: "Inter", style: "Bold" });`}
section.appendChild(node);
return node.id;`)) as string;
  const runs = async (id: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return { characters: node.characters, runs: node.getStyledTextSegments(["fontName"]).map(({ characters, fontName }) => [characters, fontName.style]) };`);

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    if (client === undefined) {
      return;
    }

    try {
      await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}`);
    } finally {
      await client.close();
    }
  });

  // T-141, P-152: Figma gives new characters the first one's look; the longest run's is restored over them.
  it("keeps the look of the text's longest run under new characters", async () => {
    const id = await text("retype", "Big label", [3, 9]);
    const applied = await apply(`<Text id="${id}">Other words</Text>`);

    expect(applied.errors).toEqual([]);
    expect(await runs(id)).toEqual({ characters: "Other words", runs: [["Other words", "Bold"]] });
  });

  // Try it, T-141: a Span styles its run, the rest keeps the text's look.
  it("writes a bold Span over its run", async () => {
    const id = await text("span", "Team");
    const applied = await apply(`<Text id="${id}">Team <Span font="700 16px/normal 'Inter'">Pro</Span></Text>`);

    expect(applied.errors).toEqual([]);
    expect(await runs(id)).toEqual({
      characters: "Team Pro",
      runs: [
        ["Team ", "Regular"],
        ["Pro", "Bold"],
      ],
    });
  });

  // P-078, P-152: Figma refuses a range of no characters, so an empty text takes its font on the layer itself.
  it("writes the font of an empty text through the layer", async () => {
    const id = await text("empty", "");
    const applied = await apply(`<Text id="${id}" font="700 16px/normal 'Inter'"/>`);

    expect(applied.errors).toEqual([]);
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return [node.characters, node.fontName.style];`),
    ).toEqual(["", "Bold"]);
  });

  // P-077, Tests line: an unknown family names the near one, on a dry run and a real one alike, and writes nothing.
  it("refuses an unknown family with Did you mean Inter?", async () => {
    const id = await text("family", "Label");
    const xml = `<Text id="${id}" font="400 16px/normal 'Intr'"/>`;
    const refusal = { id, attribute: "font", message: "Figma has no font family Intr.", hint: "Did you mean Inter?" };

    expect((await apply(xml, true)).errors).toEqual([refusal]);
    expect(await apply(xml)).toMatchObject({ changed: [], errors: [refusal] });
  });

  // T-140, B-031: a TextPath's d stays as made (refused, not dropped); its start moves.
  it("refuses a TextPath's d change and moves its start", async () => {
    const id = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const vector = figma.createVector();
vector.vectorPaths = [{ windingRule: "NONE", data: ${JSON.stringify(ARC)} }];
const node = figma.createTextPath(vector, 0, 0);
node.name = ${JSON.stringify(`${PREFIX}path`)};
node.characters = "Arc";
section.appendChild(node);
return node.id;`)) as string;
    const refused = await apply(`<TextPath id="${id}" d="M 0 0 L 100 0"/>`);
    const moved = await apply(`<TextPath id="${id}" start="0 0.5"/>`);

    expect(refused.errors).toMatchObject([{ id, attribute: "d" }]);
    expect(moved).toMatchObject({ changed: [id], errors: [] });
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return node.textPathStartData;`),
    ).toEqual({ segment: 0, position: 0.5 });
  });

  // T-140, FX-043: a new TextPath is made along its arc, in Inter Regular before its characters (FX-040).
  it("makes a new TextPath along an arc", async () => {
    const applied = await apply(`<TextPath name="${PREFIX}new" arc="200 200 100 -90 90">Over the top</TextPath>`);
    const id = applied.created[0]?.id ?? "";

    expect(applied.errors).toEqual([]);
    expect(
      await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return [node.type, node.characters];`),
    ).toEqual(["TEXT_PATH", "Over the top"]);
  });
});
