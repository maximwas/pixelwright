import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install } = TEST_MCP.ids;

const NAME = {
  frame: "live:design-read:frame",
  hidden: "live:design-read:hidden",
  other: "live:design-read:other",
} as const;

/** An id no file has: the read op lists it as missing. */
const MISSING = "999999:1";

/** The layers the cases read, made once in the scratch Section. */
interface Made {
  readonly frame: string;
  readonly hidden: string;
  readonly other: string;
}

// Makes its layers through execute, so no retry; the run's sweep removes every live: layer at the end.
describe("read/design-read", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  let made: Made;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();

    const { result } = await client.call("execute", {
      file,
      code: `const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(NAME.frame)};
section.appendChild(frame);
const hidden = figma.createRectangle();
hidden.name = ${JSON.stringify(NAME.hidden)};
frame.appendChild(hidden);
hidden.visible = false;
const other = figma.createRectangle();
other.name = ${JSON.stringify(NAME.other)};
section.appendChild(other);
other.x = frame.x + frame.width + 100;
return { frame: frame.id, hidden: hidden.id, other: other.id };`,
    });

    made = result as Made;
  });

  afterAll(async () => {
    await client.call("execute", { file, code: "figma.currentPage.selection = [];" });
    await client.close();
  });

  it("reads the Install card as design XML with its id on the root, and names it in the JSON (T-053)", async () => {
    const [xml, json] = await client.texts("design_read", { file, node: install });

    expect(xml).toMatch(new RegExp(`^<\\w+ id="${install}" `));
    expect(JSON.parse(json ?? "null")).toMatchObject({ node: install });
  });

  it("answers an id the read op lists as missing with NODE_NOT_FOUND and where ids come from (P-072)", async () => {
    await expect(client.texts("design_read", { file, node: MISSING })).rejects.toThrow(
      `NODE_NOT_FOUND: No node ${MISSING} in this file: find ids with nodes_find, outline or selection_get.`,
    );
  });

  it("reads a hidden layer execute made as a stub with display none, and refuses it as the root (T-052, D-18)", async () => {
    const [xml] = await client.texts("design_read", { file, node: made.frame });

    expect(xml).toMatch(new RegExp(`<Rectangle id="${made.hidden}"[^>]* display="none"`));
    await expect(client.texts("design_read", { file, node: made.hidden })).rejects.toThrow(
      `OP_FAILED: ${made.hidden} is hidden in Figma`,
    );
  });

  it("refuses two selected layers with NODE_NOT_FOUND and the advice to select one or pass node (T-051, D-64)", async () => {
    await client.call("execute", {
      file,
      code: `const frame = await pw.node(${JSON.stringify(made.frame)});
let page = frame.parent;
while (page.type !== "PAGE") page = page.parent;
await figma.setCurrentPageAsync(page);
page.selection = [frame, await pw.node(${JSON.stringify(made.other)})];`,
    });

    await expect(client.texts("design_read", { file })).rejects.toThrow(
      "NODE_NOT_FOUND: 2 layers are selected: select one, or pass node.",
    );
  });
});
