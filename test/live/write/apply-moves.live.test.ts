import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const PREFIX = "live:apply-moves:";

type Applied = {
  created: { line: number; ref: string; tag: string; id?: string; name?: string }[];
  changed: string[];
  errors: { line: number; column: number; id?: string; attribute?: string; message: string; hint?: string }[];
};

// design_apply's moves, copies and pages (item 40): layers are made by execute in the scratch Section, named
// live:apply-moves:<case>, and removed after; a page is made only while the file has a free page slot (A§15.13).
describe("write/design_apply moves, copies and pages in Figma", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, ...more })) as Applied;
  /** A frame in the scratch Section with rectangles a, b and c: their ids by name. */
  const row = async (name: string): Promise<Record<string, string>> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(PREFIX + name)};
section.appendChild(frame);
const ids = { frame: frame.id };
for (const letter of ["a", "b", "c"]) {
  const box = figma.createRectangle();
  box.name = letter;
  box.resize(10, 10);
  frame.appendChild(box);
  ids[letter] = box.id;
}
return ids;`)) as Record<string, string>;
  const order = async (id: string): Promise<string[]> =>
    (await run(
      `return (await figma.getNodeByIdAsync(${JSON.stringify(id)})).children.map((child) => child.name);`,
    )) as string[];

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const node of section.findAll((node) => node.name.startsWith(${JSON.stringify(PREFIX)}))) {
  if (!node.removed) node.remove();
}
for (const page of figma.root.children) {
  if (page.name.startsWith(${JSON.stringify(PREFIX)}) && figma.root.children.length > 1) page.remove();
}`);
    await client.close();
  });

  // T-124, FX-061: insertChild reads the index in the list as it is, so a move either way lands before the sibling.
  it("moves a layer before a sibling to that sibling's index, backwards and forwards", async () => {
    const ids = await row("order");

    expect((await apply(`<Rectangle id="${ids.c}" before="${ids.a}"/>`)).errors).toEqual([]);
    expect(await order(ids.frame ?? "")).toEqual(["c", "a", "b"]);

    const forward = await apply(`<Rectangle id="${ids.c}" before="${ids.b}"/>`);

    expect(forward).toMatchObject({ changed: [ids.c], errors: [] });
    expect(await order(ids.frame ?? "")).toEqual(["a", "c", "b"]);
  });

  // T-126, B-019: copyOf clones the layer; an element with the source's inner id writes the copy's layer, listed in
  // changed, and the source keeps its own.
  it("writes the copy's layer for an inner id of the source, not the source's", async () => {
    const ids = await row("source");
    const applied = await apply(
      `<Frame copyOf="${ids.frame}" name="${PREFIX}copy"><Rectangle id="${ids.b}" width="30px"/></Frame>`,
      { parent: scratch },
    );

    expect(applied.errors).toEqual([]);
    expect(applied.created).toMatchObject([{ tag: "Frame", name: `${PREFIX}copy` }]);

    const widths = (await run(`const copy = await figma.getNodeByIdAsync(${JSON.stringify(applied.created[0]?.id)});
const source = await figma.getNodeByIdAsync(${JSON.stringify(ids.b)});
return { copy: copy.children.map((child) => child.width), source: source.width, changed: copy.children[1].id };`)) as {
      copy: number[];
      source: number;
      changed: string;
    };

    expect(widths).toMatchObject({ copy: [10, 30, 10], source: 10 });
    expect(applied.changed).toEqual([widths.changed]);
  });

  const childIds = async (id: string): Promise<string[]> =>
    (await run(
      `return (await figma.getNodeByIdAsync(${JSON.stringify(id)})).children.map((child) => child.id);`,
    )) as string[];

  // T-124: a layer goes into another frame, after a layer of that frame.
  it("moves a layer to another parent, after a layer there", async () => {
    const from = await row("from");
    const to = await row("to");
    const applied = await apply(`<Frame id="${to.frame}"><Rectangle id="${from.a}" after="${to.b}"/></Frame>`);

    expect(applied.errors).toEqual([]);
    expect(await childIds(to.frame ?? "")).toEqual([to.a, to.b, from.a, to.c]);
    expect(await childIds(from.frame ?? "")).toEqual([from.b, from.c]);
  });

  // T-124 dry run: it refuses what a real run would, with the same text (a missing neighbour, a text as holder).
  it("refuses in a dry run the moves a real run refuses", async () => {
    const ids = await row("refused");
    const textId = (await run(`await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const text = figma.createText();
text.name = ${JSON.stringify(`${PREFIX}refused-text`)};
(await pw.node(${JSON.stringify(scratch)})).appendChild(text);
return text.id;`)) as string;
    const missing = `<Rectangle id="${ids.a}" before="1:99999999"/>`;
    const intoText = `<Text id="${textId}"><Rectangle id="${ids.a}"/></Text>`;

    for (const xml of [missing, intoText]) {
      const dry = await apply(xml, { dryRun: true });
      const real = await apply(xml);

      expect(dry.errors.length).toBeGreaterThan(0);
      expect(dry.errors.map((error) => error.message)).toEqual(real.errors.map((error) => error.message));
    }

    expect(await order(ids.frame ?? "")).toEqual(["a", "b", "c"]);
  });

  // T-124: inside an instance only a slot takes layers; the instance's own child refuses.
  it("refuses a layer moved into an instance's non-slot child", async (context) => {
    const ids = await row("instance");
    const made = (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const component = figma.createComponent();
component.name = ${JSON.stringify(`${PREFIX}component`)};
section.appendChild(component);
const inner = figma.createFrame();
inner.name = "inner";
component.appendChild(inner);
let slot = false;
try {
  component.createSlot();
  slot = true;
} catch {}
const instance = component.createInstance();
instance.name = ${JSON.stringify(`${PREFIX}instance`)};
section.appendChild(instance);
return { inner: instance.children[0].id, slot, slotId: instance.children.find((child) => child.type === "SLOT")?.id };`)) as {
      inner: string;
      slot: boolean;
      slotId?: string;
    };
    const refused = await apply(`<Frame id="${made.inner}"><Rectangle id="${ids.a}"/></Frame>`);

    expect(refused.errors).toMatchObject([{ message: expect.stringContaining("only through its slots") }]);
    expect(await childIds(ids.frame ?? "")).toContain(ids.a);

    if (made.slotId === undefined) {
      context.annotate("this Figma could not make a slot: only the refusal checked");

      return;
    }

    expect((await apply(`<Frame id="${made.slotId}"><Rectangle id="${ids.a}"/></Frame>`)).errors).toEqual([]);
    expect(await childIds(made.slotId)).toEqual([ids.a]);
  });

  // B-019: inside a copy a SOURCE's id as before names the copy's own layer.
  it("lands before a source's id inside a copy at the copy's counterpart", async () => {
    const ids = await row("counterpart");
    const applied = await apply(
      `<Frame copyOf="${ids.frame}" name="${PREFIX}counterpart-copy"><Rectangle id="${ids.c}" before="${ids.a}"/></Frame>`,
      { parent: scratch },
    );

    expect(applied.errors).toEqual([]);
    expect(await order(applied.created[0]?.id ?? "")).toEqual(["c", "a", "b"]);
    expect(await order(ids.frame ?? "")).toEqual(["a", "b", "c"]);
  });

  // T-125, FX-054, A§15.13: a new page goes last; without a free page slot the Starter limit is named and nothing made.
  it("makes a page last, or names the plan's page limit when the file has no free slot", async (context) => {
    const pages = (await run("return figma.root.children.length;")) as number;
    const applied = await apply(`<Page name="${PREFIX}page"/>`);

    if (pages < TEST_MCP.pages.length) {
      expect(applied.errors).toEqual([]);
      expect(await run("return figma.root.children.at(-1).name;")).toBe(`${PREFIX}page`);

      return;
    }

    expect(applied.created).toEqual([]);
    expect(applied.errors).toMatchObject([
      { line: 1, message: expect.stringMatching(new RegExp(`plan allows \\d+ pages: ${PREFIX}page is not made`)) },
    ]);
    context.annotate("no free page slot in Test MCP: the page was not made, only the limit text checked (A§15.13)");
  });
});
