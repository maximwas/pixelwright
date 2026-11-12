import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PREFIX = "live:apply-paint:";

/** The collection this file binds: live/ink (opaque), live/shade (a quarter alpha). Variables are not layers. */
const COLLECTION = `${PREFIX}tokens`;

const removeTokens = `for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
  if (collection.name === ${JSON.stringify(COLLECTION)}) collection.remove();
}`;

const makeTokens = `${removeTokens}
const collection = figma.variables.createVariableCollection(${JSON.stringify(COLLECTION)});
const ink = figma.variables.createVariable("live/ink", collection, "COLOR");
const shade = figma.variables.createVariable("live/shade", collection, "COLOR");
ink.setValueForMode(collection.defaultModeId, { r: 0.2, g: 0.4, b: 0.6, a: 1 });
shade.setValueForMode(collection.defaultModeId, { r: 0.1, g: 0.2, b: 0.3, a: 0.25 });
return { ink: ink.id, shade: shade.id };`;

type Applied = { changed: string[]; errors: { attribute?: string; message: string; hint?: string }[] };

// design_apply's paints, effects and tokens (item 41) on frames execute makes in the Live tests Section, named
// live:apply-paint:<case> and removed after, with the colour variables of one collection made and removed here.
describe("write/design_apply paints, effects and tokens", () => {
  const { file, scratch } = inject("live");
  let client: LiveClient;
  let tokens: { ink: string; shade: string };

  const run = async (code: string): Promise<unknown> => (await client.call("execute", { file, code })).result;
  const apply = async (xml: string, more: Record<string, unknown> = {}): Promise<Applied> =>
    (await client.call("design_apply", { file, xml, ...more })) as Applied;
  /** A frame made by execute in the scratch Section, with the effects given (Figma's own shapes). */
  const frame = async (name: string, effects = "[]"): Promise<string> =>
    (await run(`const section = await pw.node(${JSON.stringify(scratch)});
const frame = figma.createFrame();
frame.name = ${JSON.stringify(PREFIX + name)};
frame.resize(200, 100);
frame.fills = [];
frame.effects = ${effects};
section.appendChild(frame);
return frame.id;`)) as string;
  const node = async (id: string, fields: string): Promise<unknown> =>
    await run(`const node = await figma.getNodeByIdAsync(${JSON.stringify(id)});
return JSON.parse(JSON.stringify(${fields}));`);

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
    tokens = (await run(makeTokens)) as typeof tokens;
  });

  afterAll(async () => {
    try {
      await run(removeTokens);
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

  // FX-046, C-020: the paint is built from the variable's value, then bound (no black placeholder), and a lowered
  // opacity stays on it.
  it("binds a var() background to its variable and keeps a lowered opacity", async () => {
    const id = await frame("bound");
    const applied = await apply(
      `<Frame id="${id}" background="color-mix(in srgb, var(--live-ink) 40%, transparent)"/>`,
    );

    expect(applied.errors).toEqual([]);

    const [fill] = (await node(id, "node.fills")) as {
      opacity: number;
      color: { r: number; g: number; b: number };
      boundVariables: { color: { id: string } };
    }[];

    expect(fill?.boundVariables.color.id).toBe(tokens.ink);
    expect(fill?.opacity).toBeCloseTo(0.4, 3);
    expect(fill?.color).toMatchObject({
      r: expect.closeTo(0.2, 3),
      g: expect.closeTo(0.4, 3),
      b: expect.closeTo(0.6, 3),
    });
  });

  // T-135, m:54e0e1cc: an unknown name is refused with the near one, as fast as a known one (no CSS read on the way).
  it("answers an unknown var() with Did you mean, as fast as a known one", async () => {
    const id = await frame("unknown");
    const known = performance.now();

    await apply(`<Frame id="${id}" background="var(--live-ink)"/>`, { dryRun: true });

    const knownMs = performance.now() - known;
    const unknown = performance.now();
    const applied = await apply(`<Frame id="${id}" background="var(--live-inq)"/>`, { dryRun: true });
    const unknownMs = performance.now() - unknown;

    expect(applied.errors).toMatchObject([
      { attribute: "background", hint: expect.stringContaining("Did you mean --live-ink?") },
    ]);
    expect(unknownMs / knownMs).toBeLessThan(5);
  });

  // P-092, FX-020: the gradient's transform is made at the layer's size, so a read of a 200 x 100 frame keeps 90deg.
  it("writes a gradient at the layer's size", async () => {
    const id = await frame("gradient");
    const applied = await apply(`<Frame id="${id}" background="linear-gradient(90deg, #ff0000 0%, #0000ff 100%)"/>`);

    expect(applied.errors).toEqual([]);
    expect((await client.texts("design_read", { file, node: id }))[0]).toContain(
      "linear-gradient(90deg, #F00 0%, #00F 100%)",
    );
  });

  // FX-048: a shadow's colour bound to a variable keeps the variable's alpha inside the effect's colour.
  it("binds a shadow colour to its variable and keeps its alpha", async () => {
    const id = await frame("shadow");
    const applied = await apply(`<Frame id="${id}" box-shadow="0 8px 24px 0 var(--live-shade)"/>`);

    expect(applied.errors).toEqual([]);
    expect(await node(id, "{ opacity: node.opacity, effects: node.effects }")).toMatchObject({
      opacity: 1,
      effects: [
        {
          type: "DROP_SHADOW",
          radius: 24,
          offset: { x: 0, y: 8 },
          color: { a: expect.closeTo(0.25, 3) },
          boundVariables: { color: { id: tokens.shade } },
        },
      ],
    });
  });

  // C-103, FX-057: what CSS cannot write (noise, glass) stays where it was when a blur is added.
  it("keeps noise and glass when a blur is added", async () => {
    const id = await frame(
      "noise",
      `[{ type: "NOISE", noiseType: "MONOTONE", color: { r: 0, g: 0, b: 0, a: 0.25 }, noiseSize: 0.5, density: 0.5, blendMode: "NORMAL", visible: true },
  { type: "GLASS", lightIntensity: 0.5, lightAngle: 45, refraction: 0.5, depth: 10, dispersion: 0, radius: 4, visible: true }]`,
    );
    const applied = await apply(`<Frame id="${id}" filter="blur(4px)"/>`);

    expect(applied.errors).toEqual([]);
    expect(await node(id, "node.effects.map((effect) => effect.type)")).toEqual(["NOISE", "GLASS", "LAYER_BLUR"]);
  });
});
