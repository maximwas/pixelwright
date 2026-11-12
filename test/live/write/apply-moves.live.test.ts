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
