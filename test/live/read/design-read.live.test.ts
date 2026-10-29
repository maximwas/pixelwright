import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install, customers, sticker, planPro } = TEST_MCP.ids;

const NAME = {
  frame: "live:design-read:frame",
  hidden: "live:design-read:hidden",
  other: "live:design-read:other",
  gradient: "live:design-read:gradient",
} as const;

/** Figma's transform for CSS 30deg on a 200 x 100 box: getCSSAsync reads it as 49deg (FX-020). */
const THIRTY_DEGREES = [
  [0.535898, -0.464102, 0.464102],
  [0.928203, 0.267949, -0.098076],
];

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

  // C-030: the Install card is a vertical auto layout; tokens come in item 20, so the values are raw px.
  it("reads the Install card's auto layout as flex with its padding and gap (C-030)", async () => {
    const [xml] = await client.texts("design_read", { file, node: install });
    const [root = ""] = (xml ?? "").split("\n");

    expect(root).toContain('display="flex" flex-direction="column"');
    expect(root).toContain('padding="24px"');
    expect(root).toContain('gap="8px"');
  });

  // C-080, C-090: the Install card's fill (it has no stroke) and its texts' fills as color, the Pro plan card's inside
  // stroke as border; the read holds no variables until item 20, so the colours are raw.
  it("reads the Install card's background, its texts' color and the Pro card's border (C-080, C-090)", async () => {
    const [xml] = await client.texts("design_read", { file, node: install });
    const [root = "", ...rest] = (xml ?? "").split("\n");
    const colour = String.raw`(#[0-9A-F]{3,6}|rgba\([^)]*\)|color\(display-p3 [^)]*\))`;
    const [pro] = await client.texts("design_read", { file, node: planPro, depth: 0 });

    expect(root).toMatch(new RegExp(`background="${colour}"`));
    expect(root).not.toContain("border=");
    expect(
      rest.filter((line) => line.includes("<Text ")).every((line) => new RegExp(` color="${colour}"`).test(line)),
    ).toBe(true);
    expect(rest.some((line) => line.includes("<Text "))).toBe(true);
    expect(pro ?? "").toMatch(new RegExp(`border="2px solid ${colour}"`));
  });

  // C-050, C-057: the sticker is turned 8 degrees in a frame without auto layout: placed by its centre, turned back.
  it("reads Orbit's turned sticker placed absolutely with transform rotate() (C-050, C-057)", async () => {
    const [xml] = await client.texts("design_read", { file, node: customers });
    const line = (xml ?? "").split("\n").find((row) => row.includes(`id="${sticker}"`)) ?? "";

    expect(line).toContain('position="absolute"');
    expect(line).toMatch(/transform="rotate\(-8deg\)"/);
  });

  // C-083, C-100, C-101: the aspect-corrected angle, a blur of radius 20 as blur(8.6px) (0.43 R), a card's shadow.
  it("reads a gradient and a blur execute made, and the Pro card's shadow (C-083, C-100, C-101)", async () => {
    const { result } = await client.call("execute", {
      file,
      code: `const section = await pw.node(${JSON.stringify(scratch)});
const box = figma.createRectangle();
box.name = ${JSON.stringify(NAME.gradient)};
section.appendChild(box);
box.resize(200, 100);
box.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: ${JSON.stringify(THIRTY_DEGREES)}, gradientStops: [
  { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
  { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
] }];
box.effects = [{ type: "LAYER_BLUR", blurType: "NORMAL", radius: 20, visible: true }];
return box.id;`,
    });
    const id = String(result);

    try {
      const [xml] = await client.texts("design_read", { file, node: id });

      expect(xml).toContain('background="linear-gradient(30deg, #F00 0%, #00F 100%)"');
      expect(xml).toContain('filter="blur(8.6px)"');
    } finally {
      await client.call("execute", { file, code: `(await pw.node(${JSON.stringify(id)})).remove();` });
    }

    const [pro] = await client.texts("design_read", { file, node: planPro, depth: 0 });

    expect(pro ?? "").toMatch(/box-shadow="(var\(--Shadow-Card\)|0 12px 32px -8px [^"]+)"/);
  });

  // C-112, C-123: each text's font shorthand (the read holds no styles until item 20, so no textStyle yet), and the
  // JSON block's text styles and fonts.
  it("reads the Install card's texts with their font and lists the fonts in the JSON (C-112, C-123)", async () => {
    const [xml, json] = await client.texts("design_read", { file, node: install });
    const texts = (xml ?? "").split("\n").filter((line) => line.includes("<Text "));
    const answer = JSON.parse(json ?? "null") as { textStyles: object; fonts: Record<string, string[]> };

    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((line) => / font="(italic )?\d+ \d+px\/(\d+px|normal) '[^']+'"/.test(line))).toBe(true);
    expect(answer.textStyles).toBeTypeOf("object");
    expect(Object.keys(answer.fonts).length).toBeGreaterThan(0);
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
