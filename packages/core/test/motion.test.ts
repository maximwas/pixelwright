import { describe, expect, it } from "vitest";
import { designMotion, motionSummary, type Snapshot, type SnapshotNode } from "../src/index.ts";

type Motion = NonNullable<SnapshotNode["motion"]>;
type Track = Motion["tracks"][number];

const EASE_OUT = [0, 0, 0.58, 1];
const LINEAR = [0, 0, 1, 1];

const at = (t: number, value: unknown, easing = "LINEAR", bezier: number[] | undefined = LINEAR) => ({
  t,
  value:
    typeof value === "number"
      ? {
          type: "FLOAT",
          value,
        }
      : (value as { type: string; value: unknown }),
  easing: {
    type: easing,
    ...(bezier === undefined ? {} : { bezier }),
  },
});

const track = (field: string, keyframes: Track["keyframes"], extra: Partial<Track> = {}): Track => ({
  field,
  operation: "SET",
  base: {
    type: "FLOAT",
    value: 0,
  },
  keyframes,
  ...extra,
});

const animated = (
  id: string,
  name: string,
  tracks: Track[],
  { timeline = 1.2 as number | null, type = "FRAME" } = {},
): SnapshotNode => ({
  id,
  name,
  type,
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  childCount: 0,
  motion: {
    ...(timeline === null ? {} : { timeline }),
    styles: [],
    tracks,
  },
});

const read = (...children: SnapshotNode[]): Snapshot => ({
  root: {
    id: "1:1",
    name: "Hero",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    childCount: children.length,
    children,
  },
  styles: {},
  variables: {},
});

const fade = () => track("OPACITY", [at(0, 0, "EASE_OUT", EASE_OUT), at(0.6, 1, "EASE_OUT", EASE_OUT)]);

describe("Figma Motion in a read", () => {
  it("writes a layer's keyframes at their times over the timeline, each easing on the keyframe it leaves", () => {
    const card = animated("1:2", "Card", [fade()]);
    const view = designMotion(read(card));

    expect(motionSummary(card)).toBe("opacity 0→1; 0–0.6s ease-out");
    expect(view?.timeline).toBe("1.2s");
    expect(view?.css).toBe(
      [
        "@keyframes card {",
        "  0% { opacity: 0; animation-timing-function: ease-out; }",
        "  50% { opacity: 1; }",
        "  100% { opacity: 1; }",
        "}",
        ".card { animation: card 1.2s linear both; }",
      ].join("\n"),
    );
    expect(view?.layers).toEqual([
      {
        id: "1:2",
        name: "Card",
        class: "card",
        tracks: card.motion?.tracks,
      },
    ]);
  });

  it("makes OFFSET and SCALE keyframes absolute from the base value, and names the style that made them", () => {
    const title = animated("1:2", "Title", [
      track("TRANSLATION_X", [at(0.2, -200, "EASE_OUT", EASE_OUT), at(0.8, 0, "EASE_OUT", EASE_OUT)], {
        operation: "OFFSET",
        base: {
          type: "FLOAT",
          value: 10,
        },
        style: "motion.preset_name.position",
      }),
      track("TRANSLATION_Y", [at(0.2, 0, "EASE_OUT", EASE_OUT), at(0.8, 0, "EASE_OUT", EASE_OUT)], {
        operation: "OFFSET",
        style: "motion.preset_name.position",
      }),
      track("OPACITY", [at(0, 0), at(0.6, 1)], {
        operation: "SCALE",
        base: {
          type: "FLOAT",
          value: 0.8,
        },
        style: "motion.preset_name.opacity",
      }),
    ]);
    const css = designMotion(read(title))?.css ?? "";

    expect(motionSummary(title)).toBe(
      "Position, Opacity: translate-x -190→10px 0.2–0.8s ease-out, opacity 0→0.8 0–0.6s linear",
    );
    expect(css).toContain("  0% { translate: -190px 0; opacity: 0; }");
    expect(css).toContain("  16.67% { translate: -190px 0; animation-timing-function: ease-out; }");
    expect(css).toContain("  50% { opacity: 0.8; }");
    expect(css).toContain("  66.67% { translate: 10px 0; }");
    expect(css).toContain("  100% { translate: 10px 0; opacity: 0.8; }");
  });

  it("animates rotation and scale with rotate and scale, and colours as background, a text's color, a border's", () => {
    const blue = {
      type: "COLOR",
      value: {
        r: 0.2314,
        g: 0.1843,
        b: 0.851,
        a: 1,
      },
    };
    const white = {
      type: "COLOR",
      value: {
        r: 1,
        g: 1,
        b: 1,
        a: 1,
      },
    };
    const badge = animated("1:2", "Badge", [
      track("ROTATION", [at(0, 0), at(0.6, 90)]),
      track("SCALE_XY", [
        at(0, {
          type: "VECTOR",
          value: {
            x: 1,
            y: 1,
          },
        }),
        at(0.6, {
          type: "VECTOR",
          value: {
            x: 1.2,
            y: 1.2,
          },
        }),
      ]),
      track("fills.0", [at(0, white), at(0.6, blue)]),
      track("strokes.0", [at(0, white), at(0.6, blue)]),
    ]);
    const label = animated("1:3", "Label", [track("fills.0", [at(0, white), at(0.6, blue)])], { type: "TEXT" });
    const css = designMotion(read(badge, label))?.css ?? "";

    expect(css).toContain("  0% { rotate: 0deg; scale: 1; background-color: #FFF; border-color: #FFF; }");
    expect(css).toContain("  50% { rotate: -90deg; scale: 1.2; background-color: #3B2FD9; border-color: #3B2FD9; }");
    expect(css).toMatch(/@keyframes label \{\n {2}0% \{ color: #FFF; \}/);
  });

  it("says in a comment what CSS cannot animate this way, never writing it as a property", () => {
    const line = animated("1:2", "Line", [track("PATH_TRIM_END", [at(0, 0), at(0.6, 1)]), fade()]);
    const css = designMotion(read(line))?.css ?? "";

    expect(css).toContain("/* path-trim-end 0→1: draw the stroke with stroke-dasharray and stroke-dashoffset */");
    expect(css).not.toMatch(/path-trim-end:/);
    expect(motionSummary(line)).toBe("path-trim-end 0→1 0–0.6s linear, opacity 0→1 0–0.6s ease-out");
  });

  it("times keyframes by the longest track when the timeline is missing or zero, never writing NaN", () => {
    const short = designMotion(read(animated("1:2", "Dot", [track("OPACITY", [at(0, 0), at(0.5, 1)])], {}))) ?? null;
    const untimed = designMotion(
      read(animated("1:2", "Dot", [track("OPACITY", [at(0, 0), at(0.5, 1)])], { timeline: null })),
    );
    const still = designMotion(read(animated("1:2", "Dot", [track("OPACITY", [at(0, 1)])], { timeline: 0 })));

    expect(short?.css).toContain("100% { opacity: 1; }");
    expect(untimed?.css).toContain("  100% { opacity: 1; }");
    expect(untimed?.css).toContain(".dot { animation: dot 0.5s linear both; }");
    expect(still?.css).toContain("  0% { opacity: 1; }");
    expect(still?.css).toContain(".dot { animation: dot 0s linear both; }");
    expect(`${untimed?.css}${still?.css}`).not.toMatch(/NaN|Infinity/);
  });

  it("names each class after its layer, suffixing a second layer of the same name, and never with a digit first", () => {
    const view = designMotion(
      read(animated("1:2", "Card", [fade()]), animated("1:3", "Card", [fade()]), animated("1:4", "3D", [fade()])),
    );

    expect(view?.layers.map((layer) => layer.class)).toEqual(["card", "card-2", "layer-3d"]);
  });

  it("writes a hold as steps and a custom curve as cubic-bezier", () => {
    const css =
      designMotion(
        read(
          animated("1:2", "Dot", [
            track("OPACITY", [
              at(0, 0, "HOLD", undefined),
              at(0.3, 1, "CUSTOM_CUBIC_BEZIER", [0.3, 0, 0.2, 1]),
              at(0.6, 0),
            ]),
          ]),
        ),
      )?.css ?? "";

    expect(css).toContain("0% { opacity: 0; animation-timing-function: steps(1, end); }");
    expect(css).toContain("25% { opacity: 1; animation-timing-function: cubic-bezier(0.3, 0, 0.2, 1); }");
  });

  it("gives nothing for layers without motion", () => {
    const plain: SnapshotNode = {
      id: "1:2",
      name: "Plain",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      childCount: 0,
    };

    expect(motionSummary(plain)).toBeUndefined();
    expect(designMotion(read(plain))).toBeNull();
  });
});
