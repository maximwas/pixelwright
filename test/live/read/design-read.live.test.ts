import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

const { install, customers, sticker, planPro, planStarter, signIn } = TEST_MCP.ids;

const NAME = {
  frame: "live:design-read:frame",
  hidden: "live:design-read:hidden",
  other: "live:design-read:other",
  gradient: "live:design-read:gradient",
  nearbyScreen: "live:design-read:nearby-screen",
  nearbyClose: "live:design-read:nearby-close",
  nearbyFar: "live:design-read:nearby-far",
  autoLine: "live:design-read:auto-line",
} as const;

/** Figma's transform for CSS 30deg on a 200 x 100 box: getCSSAsync reads it as 49deg (FX-020). */
const THIRTY_DEGREES = [
  [0.535898, -0.464102, 0.464102],
  [0.928203, 0.267949, -0.098076],
];

/** Orbit's Pricing hero: its icons and images are assets. */
const HERO = "54:238";

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
  });

  // T-163: the card's padding, gap and radius are bound to Orbit's variables: written as var(), valued in the JSON.
  it("reads the Install card's bound padding, gap and radius as tokens and lists them in the JSON (T-163)", async () => {
    const [xml, json] = await client.texts("design_read", { file, node: install });
    const [root = ""] = (xml ?? "").split("\n");
    const answer = JSON.parse(json ?? "null") as { tokens: Record<string, string> };

    expect(root).toContain('padding="var(--space-24)"');
    expect(root).toContain('gap="var(--space-8)"');
    expect(root).toContain('border-radius="var(--radius-md)"');
    expect(answer.tokens).toMatchObject({ "--space-24": "24px", "--space-8": "8px" });
    expect(answer.tokens["--radius-md"]).toMatch(/^\d+px$/);
  });

  // C-080, C-090: the Install card's fill (it has no stroke) and its texts' fills as color, the Pro plan card's inside
  // stroke as border; a colour bound to a variable reads as its var() (T-163).
  it("reads the Install card's background, its texts' color and the Pro card's border (C-080, C-090)", async () => {
    const [xml] = await client.texts("design_read", { file, node: install });
    const [root = "", ...rest] = (xml ?? "").split("\n");
    const colour = String.raw`(#[0-9A-F]{3,6}|rgba\([^)]*\)|color\(display-p3 [^)]*\)|var\(--[^)]+\))`;
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

  // C-112, C-123: the Install card's texts use the Body and Button text styles, so each names its style instead of a
  // font, and the JSON block gives each style's font shorthand and the fonts.
  it("reads the Install card's texts by their text style and lists the styles and fonts in the JSON (C-112, C-123)", async () => {
    const [xml, json] = await client.texts("design_read", { file, node: install });
    const texts = (xml ?? "").split("\n").filter((line) => line.includes("<Text "));
    const answer = JSON.parse(json ?? "null") as {
      textStyles: Record<string, string>;
      fonts: Record<string, string[]>;
    };

    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((line) => / textStyle="(Body|Button)"/.test(line) && !line.includes(" font="))).toBe(true);
    expect(answer.textStyles).toMatchObject({ Body: expect.stringMatching(/^\d+ \d+px\/\d+px 'Inter'$/) });
    expect(answer.fonts).toHaveProperty("Inter");
  });

  // C-136: an instance names its component (a variant its set), its variant values and its own properties, ids cut.
  it("reads a Plan Card instance's component and props, and the Sign in button's variant (C-136)", async () => {
    const [card = ""] = ((await client.texts("design_read", { file, node: planStarter }))[0] ?? "").split("\n");
    const [button = ""] = ((await client.texts("design_read", { file, node: signIn }))[0] ?? "").split("\n");

    expect(card).toContain(' component="Plan Card" ');
    expect(card).toMatch(/ props="[^"]*Name=Starter[^"]*"/);
    expect(card).not.toMatch(/ props="[^"]*#/);
    expect(button).toContain(' component="Button" variant="Variant=Secondary, State=Default" props="Label=Sign in"');
  });

  // C-154, P-089: the Pro card's click goes to the checkout screen, its destination named; its Dev Mode note is read.
  it("reads the Pro card's click as a sentence and its Dev Mode note (C-154, P-089)", async () => {
    const [root = ""] = ((await client.texts("design_read", { file, node: planPro }))[0] ?? "").split("\n");

    expect(root).toContain(' $on-click="go to Checkout – Desktop; dissolve 300ms ease-out"');
    expect(root).toContain(' note="The price comes from the billing API.');
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

  it("reads Orbit's icons as Icon and its images as Image with their files, and lists them in the JSON (C-142, C-144)", async () => {
    const [hero = "", heroJson = "{}"] = await client.texts("design_read", { file, node: HERO });
    const [xml = "", json = "{}"] = await client.texts("design_read", { file, node: customers });
    const { assets } = JSON.parse(json) as { assets: { node: string; src?: string }[] };

    expect(hero).toContain('<Image id="54:317" name="Planet" src="assets/planet.png"');
    expect((JSON.parse(heroJson) as { assets: unknown[] }).assets.length).toBeGreaterThan(0);
    expect(xml).toContain(
      '<Icon id="54:437" name="Logo" component="Logo" variant="Brand=Nova" src="assets/logo-nova.svg"',
    );
    expect(xml).toMatch(/<Image id="54:454" name="Product shot" src="assets\/product-shot\.png"/);
    expect(assets).toContainEqual({
      node: "54:454",
      kind: "image",
      format: "PNG",
      src: "assets/product-shot.png",
      scale: 2,
    });
    expect(assets.map(({ node }) => node)).toContain("54:452");
  });

  it("lists a note 100 px from the screen and not one 6000 px away with nearby (T-058)", async () => {
    const { result } = await client.call("execute", {
      file,
      code: `const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const screen = figma.createFrame();
screen.name = ${JSON.stringify(NAME.nearbyScreen)};
section.appendChild(screen);
screen.resize(400, 300);
const note = (name, dx, words) => {
  const text = figma.createText();
  text.name = name;
  section.appendChild(text);
  text.characters = words;
  text.x = screen.x + screen.width + dx;
  text.y = screen.y;
  return text.id;
};
return { screen: screen.id, close: note(${JSON.stringify(NAME.nearbyClose)}, 100, "Cards lift on hover."), far: note(${JSON.stringify(NAME.nearbyFar)}, 6000, "Try a carousel?") };`,
    });
    const ids = result as { screen: string; close: string; far: string };

    try {
      const [, json] = await client.texts("design_read", { file, node: ids.screen, nearby: 300 });
      const { nearby } = JSON.parse(json ?? "{}") as {
        nearby: { screen: { id: string }; notes: { id: string; side: string; distance: number }[] };
      };

      expect(nearby.screen.id).toBe(ids.screen);
      expect(nearby.notes).toContainEqual(expect.objectContaining({ id: ids.close, side: "right", distance: 100 }));
      expect(nearby.notes.map(({ id }) => id)).not.toContain(ids.far);
    } finally {
      await client.call("execute", {
        file,
        code: `for (const id of ${JSON.stringify(Object.values(ids))}) (await pw.node(id)).remove();`,
      });
    }
  });

  it('reads a hugging Inter 16 text at 19px with autoLineHeight "px", normal without (T-060, FX-042)', async () => {
    const { result } = await client.call("execute", {
      file,
      code: `const section = await pw.node(${JSON.stringify(scratch)});
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const text = figma.createText();
text.name = ${JSON.stringify(NAME.autoLine)};
section.appendChild(text);
text.fontName = { family: "Inter", style: "Regular" };
text.fontSize = 16;
text.characters = "Sign in";
return text.id;`,
    });
    const id = String(result);

    try {
      const [px] = await client.texts("design_read", { file, node: id, autoLineHeight: "px" });
      const [normal, json] = await client.texts("design_read", { file, node: id });

      expect(px).toContain("400 16px/19px 'Inter'");
      expect(normal).toContain("400 16px/normal 'Inter'");
      expect(json).toContain('autoLineHeight: \\"px\\"');
    } finally {
      await client.call("execute", { file, code: `(await pw.node(${JSON.stringify(id)})).remove();` });
    }
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
