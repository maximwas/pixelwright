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

/** As design_read writes a colour of these bytes. */
function css([red, green, blue]: [number, number, number]): string {
  return Color.of({ r: red / 255, g: green / 255, b: blue / 255 }).css();
}

// Dry runs only: nothing is bound before item 51. The frame is removed after; the setup's sweep removes any left.
describe("write/tokens_bind", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const bind = (args: ToolResult): Promise<ToolResult> => client.call("tokens_bind", { file, ...args });

  beforeAll(async () => {
    // The weekly support sentence off: answers stay exact, and the home's week is not spent by a test (T-006).
    client = await new LiveClient().connect({ PIXELWRIGHT_SUPPORT_REMINDERS: "off" });
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await run(`const section = await pw.node(${JSON.stringify(scratch)});
for (const child of [...section.children]) if (child.name.startsWith(${JSON.stringify(PREFIX)})) child.remove();`);
    await client.close();
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
});
