import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:design-apply-text:";

type Planned = {
  errors: { id?: string; attribute?: string; message: string }[];
  changes: {
    id: string | null;
    props: Record<string, unknown>;
    sources: Record<string, string>;
    text?: { characters: string; runs: { start: number; end: number; props: Record<string, unknown> }[] };
  }[];
};

// Dry runs only: each case plans against a text made in the scratch Section by execute (Inter Regular 16, "Label"),
// named live:design-apply-text:<case>, and removed after.
describe("write/design_apply text planning", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const plan = async (xml: string): Promise<Planned> =>
    (await client.call("design_apply", { file, xml, dryRun: true })) as Planned;
  const text = async (name: string): Promise<string> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const node = figma.createText();
node.name = ${JSON.stringify(`${PREFIX}${name}`)};
node.characters = "Label";
section.appendChild(node);
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

  // Try it: new characters are the change; the look the layer has is kept (nothing else written).
  it("lists the new characters and keeps the look", async () => {
    const id = await text("characters");
    const planned = await plan(`<Text id="${id}">New label</Text>`);

    expect(planned.errors).toEqual([]);
    expect(planned.changes).toMatchObject([{ id, props: {}, text: { characters: "New label", runs: [] } }]);
  });

  // Try it, C-115: Figma has no dashed decoration, so the plan refuses it.
  it("refuses a dashed underline", async () => {
    const id = await text("dashed");
    const planned = await plan(`<Text id="${id}" text-decoration="underline dashed"/>`);

    expect(planned.errors).toMatchObject([
      {
        id,
        attribute: "text-decoration",
        message: "Figma underlines solid, wavy or dotted: it has no dashed decoration.",
      },
    ]);
  });

  // C-119: a Span is a run of the characters with what it sets over the text's own.
  it("plans a Span as a run of its characters", async () => {
    const id = await text("span");
    const planned = await plan(`<Text id="${id}">Team <Span font="700 16px/normal 'Inter'">Pro</Span></Text>`);

    expect(planned.changes[0]?.text).toMatchObject({
      characters: "Team Pro",
      runs: [{ start: 5, end: 8, props: { font: { family: "Inter", weight: 700 } } }],
    });
  });

  // C-118: a text style given (here detached) resets what it covers: the element's font and its text are sent again.
  it("sends the font and the characters again with a new text style", async () => {
    const id = await text("restyle");
    const planned = await plan(`<Text id="${id}" textStyle="" font="400 16px/normal 'Inter'">Label</Text>`);

    expect(planned.changes).toMatchObject([
      { id, sources: { textStyle: "textStyle", font: "font" }, text: { characters: "Label", runs: [] } },
    ]);
  });
});
