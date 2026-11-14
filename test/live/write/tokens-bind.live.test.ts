import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { Color } from "@/core/kernel/color/color.ts";
import { LiveClient, type ToolResult } from "../support/live-client.ts";

const PREFIX = "live:tokens-bind:";

/** What the execute snippet made: the frame, its four rectangles, and the two colours as bytes. */
interface Made {
  readonly frame: string;
  readonly rectangles: string[];
  readonly held: [number, number, number];
  readonly off: [number, number, number];
}

/**
 * In the scratch Section, a frame with no fill holding four rectangles: three filled with the raw colour of a local
 * colour variable that alone holds it in the frame's modes (no other variable, no alias to it, no paint style, a scope
 * that offers it for shapes), and one a step redder, which nothing holds.
 */
const MAKE = (scratch: string) => `const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(`${PREFIX}rectangles`)};
frame.fills = [];
section.appendChild(frame);
const collections = new Map((await figma.variables.getLocalVariableCollectionsAsync()).map((c) => [c.id, c]));
const variables = await figma.variables.getLocalVariablesAsync("COLOR");
const modes = frame.resolvedVariableModes;
const bytes = (c) => [c.r, c.g, c.b].map((v) => Math.round(v * 255));
const key = (v) => {
  const collection = collections.get(v.variableCollectionId);
  const value = v.valuesByMode[modes[collection.id] ?? collection.defaultModeId];
  return value && value.type !== "VARIABLE_ALIAS" && (value.a ?? 1) === 1 ? bytes(value).join(",") : null;
};
const held = new Map();
for (const v of variables) { const k = key(v); if (k) held.set(k, (held.get(k) ?? 0) + 1); }
for (const style of await figma.getLocalPaintStylesAsync()) {
  const solids = style.paints.filter((p) => p.visible !== false);
  if (solids.length === 1 && solids[0].type === "SOLID") held.set(bytes(solids[0].color).join(","), 2);
}
const aliased = new Set(variables.flatMap((v) => Object.values(v.valuesByMode).filter((x) => x && x.type === "VARIABLE_ALIAS").map((x) => x.id)));
const fits = (v) => v.scopes.some((s) => ["ALL_SCOPES", "ALL_FILLS", "SHAPE_FILL"].includes(s));
const offOf = (k) => { const [r, g, b] = k.split(",").map(Number); return [r === 255 ? 254 : r + 1, g, b]; };
const picked = variables.find((v) => key(v) && held.get(key(v)) === 1 && !aliased.has(v.id) && fits(v) && !held.has(offOf(key(v)).join(",")));
if (!picked) throw new Error("Test MCP has no colour variable that alone holds its colour");
const color = key(picked).split(",").map(Number);
const off = offOf(key(picked));
const rectangles = [color, color, color, off].map((channels, index) => {
  const rectangle = figma.createRectangle();
  rectangle.name = ${JSON.stringify(`${PREFIX}rectangle-`)} + index;
  rectangle.fills = [{ type: "SOLID", color: { r: channels[0] / 255, g: channels[1] / 255, b: channels[2] / 255 } }];
  frame.appendChild(rectangle);
  return rectangle.id;
});
return { frame: frame.id, rectangles, held: color, off };`;

/** The tokens a write case binds to, made by TOKENS: two colour variables, a number variable and a text style. */
interface Tokens {
  readonly from: { readonly id: string; readonly bytes: [number, number, number] };
  readonly to: { readonly id: string; readonly bytes: [number, number, number] };
  readonly radius: { readonly id: string; readonly value: number };
  readonly style: { readonly id: string; readonly size: number };
}

/** The write cases' own collection and text style, removed before they are made and after the suite. */
const TOKENS_NAME = "live-tokens-bind";

const CLEAN_TOKENS = `for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) if (collection.name === ${JSON.stringify(TOKENS_NAME)}) collection.remove();
for (const style of await figma.getLocalTextStylesAsync()) if (style.name.startsWith(${JSON.stringify(`${TOKENS_NAME}/`)})) style.remove();`;

/**
 * Tokens no other token holds the values of: two colour variables of colours no variable or paint style has, a number
 * variable of a radius no number variable has, and an Inter Regular text style of a size no text style has; all
 * scoped ALL_SCOPES, Figma's default.
 */
const TOKENS = `${CLEAN_TOKENS}
const collection = figma.variables.createVariableCollection(${JSON.stringify(TOKENS_NAME)});
const mode = collection.defaultModeId;
const values = (await figma.variables.getLocalVariablesAsync()).flatMap((v) => Object.values(v.valuesByMode));
const byte = (x) => Math.round(x * 255);
const held = new Set([
  ...values.filter((x) => x && typeof x === "object" && "r" in x).map((c) => [c.r, c.g, c.b].map(byte).join(",")),
  ...(await figma.getLocalPaintStylesAsync()).flatMap((s) => s.paints.filter((p) => p.type === "SOLID").map((p) => [p.color.r, p.color.g, p.color.b].map(byte).join(","))),
]);
const free = (start) => { const c = [...start]; while (held.has(c.join(","))) c[2] = (c[2] + 7) % 256; held.add(c.join(",")); return c; };
const colour = (name, bytes) => { const v = figma.variables.createVariable(name, collection, "COLOR"); v.setValueForMode(mode, { r: bytes[0] / 255, g: bytes[1] / 255, b: bytes[2] / 255, a: 1 }); return { id: v.id, bytes }; };
const from = colour("bind-from", free([19, 87, 155]));
const to = colour("bind-to", free([155, 87, 19]));
let radius = 7.25;
while (values.includes(radius)) radius += 1;
const round = figma.variables.createVariable("bind-radius", collection, "FLOAT");
round.setValueForMode(mode, radius);
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const sizes = new Set((await figma.getLocalTextStylesAsync()).map((s) => s.fontSize));
let size = 13.5;
while (sizes.has(size)) size += 1;
const style = figma.createTextStyle();
style.name = ${JSON.stringify(`${TOKENS_NAME}/body`)};
style.fontSize = size;
return { from, to, radius: { id: round.id, value: radius }, style: { id: style.id, size } };`;

/** A frame of the given name in the scratch Section, with `rect(name, bytes)` making raw-coloured rectangles in it. */
const FRAME = (scratch: string, name: string) => `const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(`${PREFIX}${name}`)};
frame.fills = [];
section.appendChild(frame);
const paint = (bytes) => ({ type: "SOLID", color: { r: bytes[0] / 255, g: bytes[1] / 255, b: bytes[2] / 255 } });
const rect = (name, bytes) => {
  const rectangle = figma.createRectangle();
  rectangle.name = ${JSON.stringify(PREFIX)} + name;
  rectangle.fills = bytes ? [paint(bytes)] : [];
  frame.appendChild(rectangle);
  return rectangle;
};`;

/** A rectangle of the from colour, one with no fill and the radius, a text of the style's parts with no fill. */
const THREE = (scratch: string, tokens: Tokens) => `${FRAME(scratch, "three")}
const colored = rect("colour", ${JSON.stringify(tokens.from.bytes)});
const rounded = rect("radius", null);
rounded.cornerRadius = ${tokens.radius.value};
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
const text = figma.createText();
text.name = ${JSON.stringify(`${PREFIX}text`)};
text.characters = "Bind";
text.fontSize = ${tokens.style.size};
text.fills = [];
frame.appendChild(text);
return { frame: frame.id, colored: colored.id, rounded: rounded.id, text: text.id };`;

/**
 * Two rectangles of the from and to colours, and with `component`, a component whose rectangle is bound to the from
 * variable and an instance of it, both in the Section.
 */
const PAIR = (
  scratch: string,
  tokens: Tokens,
  component: boolean,
) => `${FRAME(scratch, "pair")}
const from = rect("from", ${JSON.stringify(tokens.from.bytes)});
const to = rect("to", ${JSON.stringify(tokens.to.bytes)});
if (!${component}) return { from: from.id, to: to.id };
const main = figma.createComponent();
main.name = ${JSON.stringify(`${PREFIX}component`)};
main.fills = [];
section.appendChild(main);
const inner = figma.createRectangle();
inner.name = ${JSON.stringify(`${PREFIX}inner`)};
const variable = await figma.variables.getVariableByIdAsync(${JSON.stringify(tokens.from.id)});
inner.fills = [figma.variables.setBoundVariableForPaint(paint(${JSON.stringify(tokens.from.bytes)}), "color", variable)];
main.appendChild(inner);
const instance = main.createInstance();
instance.name = ${JSON.stringify(`${PREFIX}instance`)};
section.appendChild(instance);
return { from: from.id, to: to.id, main: inner.id, instance: instance.id, copy: instance.children[0].id };`;

/** The colour variable each layer's first fill is bound to, or null. */
const FILL_VARIABLES = (ids: readonly string[]) => `const nodes = await Promise.all(${JSON.stringify(ids)}.map((id) => figma.getNodeByIdAsync(id)));
return nodes.map((node) => node.fills[0]?.boundVariables?.color?.id ?? null);`;

/** As design_read writes a colour of these bytes. */
function css([red, green, blue]: [number, number, number]): string {
  return Color.of({ r: red / 255, g: green / 255, b: blue / 255 }).css();
}

// The frames, the component and the instance are removed after, then the suite's own tokens.
describe("write/tokens_bind", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const bind = (args: ToolResult): Promise<ToolResult> => client.call("tokens_bind", { file, ...args });
  /** The token a dry run binds the layer's raw colour to, as tokens_bind names it. */
  const tokenOf = async (layer: string): Promise<string> => {
    const { bound } = await bind({ within: layer, kinds: ["color"], dryRun: true });

    return (bound as { token: string }[])[0]?.token ?? "";
  };

  beforeAll(async () => {
    // The weekly support sentence off: answers stay exact, and the home's week is not spent by a test (T-006).
    client = await new LiveClient().connect({ PIXELWRIGHT_SUPPORT_REMINDERS: "off" });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    const left = await run(`const section = await pw.node(${JSON.stringify(scratch)});
const prefixed = (node) => node.name.startsWith(${JSON.stringify(PREFIX)});
for (const child of [...section.children]) if (prefixed(child)) child.remove();
for (const node of section.findAll(prefixed)) { try { node.remove(); } catch {} }
${CLEAN_TOKENS}
return section.findAll(prefixed).map((node) => node.name);`);

    await client.close();
    expect(left).toEqual([]);
  });

  it("finds three rectangles of a variable's raw colour bound to it and one a step off unmatched (T-167, K-028)", async () => {
    const made = (await run(MAKE(scratch))) as Made;
    const [first, second, third, fourth] = made.rectangles;
    const answer = await bind({ within: made.frame, kinds: ["color"], dryRun: true });

    expect(answer).toMatchObject({
      bound: [
        {
          kind: "color",
          field: "background",
          value: css(made.held),
          count: 3,
          examples: [first, second, third],
          token: expect.stringMatching(/^--/),
        },
      ],
      ambiguous: [],
      unmatched: [{ kind: "color", field: "background", value: css(made.off), count: 1, examples: [fourth] }],
      remapped: [],
      layers: 3,
      errors: [],
      more: false,
      summary: "Would bind 3 raw values to tokens on 3 layers; 1 value has no token.",
      dry: true,
    });
  });

  it("binds the three matches, a colour, a radius and a text style, and design_read shows var() on the rectangle (T-167)", async () => {
    const tokens = (await run(TOKENS)) as Tokens;
    const made = (await run(THREE(scratch, tokens))) as {
      frame: string;
      colored: string;
      rounded: string;
      text: string;
    };
    const answer = await bind({ within: made.frame });

    expect(answer.bound).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "color", field: "background", count: 1, examples: [made.colored] }),
        expect.objectContaining({ kind: "number", field: "border-radius", count: 1, examples: [made.rounded] }),
        expect.objectContaining({ kind: "text", field: "font", count: 1, examples: [made.text] }),
      ]),
    );
    expect(answer).toMatchObject({ errors: [], layers: 3, summary: expect.stringMatching(/^Bound 3 raw values/) });
    expect(answer.dry).toBeUndefined();
    expect(
      await run(`const [colored, rounded, text] = await Promise.all(${JSON.stringify([made.colored, made.rounded, made.text])}.map((id) => figma.getNodeByIdAsync(id)));
return { color: colored.fills[0].boundVariables?.color?.id ?? null, radius: rounded.boundVariables?.topLeftRadius?.id ?? null, style: text.textStyleId };`),
    ).toEqual({ color: tokens.from.id, radius: tokens.radius.id, style: tokens.style.id });

    const [xml = ""] = await client.texts("design_read", { file, node: made.colored });

    expect(xml).toContain('background="var(--');
  });

  it("rebinds every use of one token to another of its kind with remap (T-167, K-029)", async () => {
    const tokens = (await run(TOKENS)) as Tokens;
    const made = (await run(PAIR(scratch, tokens, false))) as { from: string; to: string };
    const from = await tokenOf(made.from);
    const to = await tokenOf(made.to);

    await bind({ within: made.from, kinds: ["color"] });

    expect(await bind({ within: made.from, remap: [{ from, to }] })).toMatchObject({
      remapped: [{ from, to, count: 1 }],
      layers: 1,
      errors: [],
    });
    expect(await run(FILL_VARIABLES([made.from, made.to]))).toEqual([tokens.to.id, null]);
  });

  it('binds only the instance\'s override in instances: "override" mode, its main component left as it was (T-167)', async () => {
    const tokens = (await run(TOKENS)) as Tokens;
    const made = (await run(PAIR(scratch, tokens, true))) as {
      from: string;
      to: string;
      main: string;
      instance: string;
      copy: string;
    };
    const from = await tokenOf(made.from);
    const to = await tokenOf(made.to);

    expect(await bind({ within: made.instance, remap: [{ from, to }], instances: "override" })).toMatchObject({
      remapped: [{ from, to, count: 1 }],
      layers: 1,
      errors: [],
    });
    expect(await run(FILL_VARIABLES([made.copy, made.main]))).toEqual([tokens.to.id, tokens.from.id]);
  });
});
