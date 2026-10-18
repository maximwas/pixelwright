import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeNode, installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

const SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  blendMode: "NORMAL",
  color: {
    r: 0,
    g: 0,
    b: 0,
    a: 0.2,
  },
  offset: {
    x: 0,
    y: 4,
  },
  radius: 12,
  spread: 0,
};
const GRAIN = {
  noiseType: "MONOTONE",
  noiseSize: 1,
  density: 0.55,
  color: {
    r: 0,
    g: 0,
    b: 0,
    a: 0.22,
  },
} as const;
const GLASS = {
  lightIntensity: 0.5,
  lightAngle: -45,
  refraction: 0.3,
  depth: 12,
  dispersion: 0.1,
  radius: 12,
};

let page: FakeNode;

const byId = (id: string) => page.children?.find((node) => node.id === id) as FakeNode;

beforeEach(() => {
  page = tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "1:1",
        name: "Hero",
        effects: [SHADOW],
      },
      {
        id: "1:2",
        type: "RECTANGLE",
        name: "Photo",
        effects: [],
      },
    ],
  });
  installFigma(page);
  plugin.services.edits.allow(true);
});

afterEach(() => {
  plugin.services.edits.allow(false);
});

const run = (input: Record<string, unknown>) =>
  plugin.run("effects", input) as Promise<{ changed: string[]; errors: { id: string; message: string }[] }>;

describe("effects: Figma's own noise, texture and glass", () => {
  it("adds noise and glass after the layer's shadow, the noise without a blend mode Figma refuses", async () => {
    const { changed, errors } = await run({
      nodes: ["1:1"],
      noise: GRAIN,
      glass: GLASS,
    });

    expect(errors).toEqual([]);
    expect(changed).toEqual(["1:1"]);
    expect(byId("1:1").effects).toEqual([
      SHADOW,
      {
        type: "NOISE",
        visible: true,
        ...GRAIN,
      },
      {
        type: "GLASS",
        visible: true,
        ...GLASS,
      },
    ]);
  });

  it("replaces a noise of its own type instead of stacking a second, and takes one off", async () => {
    await run({
      nodes: ["1:1"],
      noise: GRAIN,
    });
    await run({
      nodes: ["1:1"],
      noise: {
        ...GRAIN,
        density: 0.9,
      },
    });

    expect(byId("1:1").effects).toEqual([
      SHADOW,
      {
        type: "NOISE",
        visible: true,
        ...GRAIN,
        density: 0.9,
      },
    ]);

    await run({
      nodes: ["1:1"],
      remove: ["NOISE"],
    });

    expect(byId("1:1").effects).toEqual([SHADOW]);
  });

  it("puts glass on frames only, saying so for another layer while the others are written", async () => {
    const { changed, errors } = await run({
      nodes: ["1:1", "1:2"],
      glass: GLASS,
    });

    expect(changed).toEqual(["1:1"]);
    expect(errors).toEqual([
      {
        id: "1:2",
        message:
          "Figma puts glass on a frame only, and 1:2 is a rectangle: wrap it in a frame, or use noise or texture.",
      },
    ]);
    expect(byId("1:2").effects).toEqual([]);
  });

  it("writes nothing in a dry run, which still says what would fail and works with Allow edits off", async () => {
    plugin.services.edits.allow(false);

    const { changed, errors } = await run({
      nodes: ["1:1", "1:2", "9:9"],
      glass: GLASS,
      dryRun: true,
    });

    expect(changed).toEqual(["1:1"]);
    expect(errors.map(({ id }) => id)).toEqual(["1:2", "9:9"]);
    expect(byId("1:1").effects).toEqual([SHADOW]);
  });

  it("is refused while Allow edits is off", async () => {
    plugin.services.edits.allow(false);

    await expect(
      run({
        nodes: ["1:1"],
        noise: GRAIN,
      }),
    ).rejects.toThrow(/Allow edits/);
  });
});
