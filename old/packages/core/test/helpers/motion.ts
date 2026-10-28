import type { Snapshot, SnapshotNode } from "../../src/index.ts";

export type Motion = NonNullable<SnapshotNode["motion"]>;
export type Track = Motion["tracks"][number];

export const EASE_OUT = [0, 0, 0.58, 1];

const LINEAR = [0, 0, 1, 1];

export const at = (t: number, value: unknown, easing = "LINEAR", bezier: number[] | undefined = LINEAR) => ({
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

export const track = (field: string, keyframes: Track["keyframes"], extra: Partial<Track> = {}): Track => ({
  field,
  operation: "SET",
  base: {
    type: "FLOAT",
    value: 0,
  },
  keyframes,
  ...extra,
});

export const animated = (
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

export const screenOf = (...children: SnapshotNode[]): Snapshot => ({
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

export const fade = () => track("OPACITY", [at(0, 0, "EASE_OUT", EASE_OUT), at(0.6, 1, "EASE_OUT", EASE_OUT)]);

const BLUE = {
  type: "COLOR",
  value: {
    r: 0.2314,
    g: 0.1843,
    b: 0.851,
    a: 1,
  },
};
const WHITE = {
  type: "COLOR",
  value: {
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  },
};

/**
 * Every case of Figma Motion design_read writes, in one read: a fade, OFFSET and SCALE keyframes with their styles,
 * rotation, scale and colours on a frame, a text and a border, a move and a turn from the layer's own place, keyframes
 * given from a style's start, what CSS cannot animate, timelines missing or zero, classes of the same name or with a
 * digit first, a hold and a custom curve, and a layer without motion.
 */
export function everyMotionSnapshot(): Snapshot {
  const unplaced = animated("1:7", "Card", [
    {
      ...fade(),
      unplaced: true,
    },
  ]);

  unplaced.motion = {
    ...(unplaced.motion as Motion),
    styles: [
      {
        type: "CUSTOM",
        name: "Bounce in",
        start: 0.2,
      },
      {
        type: "FIGMA",
        name: "motion.preset_name.text_stagger",
        start: 0.4,
      },
    ],
  };

  return screenOf(
    animated("1:2", "Card", [fade()]),
    animated("1:3", "Title", [
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
    ]),
    animated("1:4", "Badge", [
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
      track("fills.0", [at(0, WHITE), at(0.6, BLUE)]),
      track("strokes.0", [at(0, WHITE), at(0.6, BLUE)]),
    ]),
    animated("1:5", "Label", [track("fills.0", [at(0, WHITE), at(0.6, BLUE)])], { type: "TEXT" }),
    animated("1:6", "Turn", [
      track("ROTATION", [at(0, 180, "LINEAR"), at(0.5, 0, "LINEAR")], {
        operation: "OFFSET",
        base: {
          type: "FLOAT",
          value: 30,
        },
      }),
      track("TRANSLATION_Y", [at(0, 120), at(0.5, 96)], {
        base: {
          type: "FLOAT",
          value: 120,
        },
      }),
    ]),
    unplaced,
    animated("1:8", "Line", [track("PATH_TRIM_END", [at(0, 0), at(0.6, 1)]), fade()]),
    animated("1:9", "Dot", [track("OPACITY", [at(0, 0), at(0.5, 1)])], { timeline: null }),
    animated("1:10", "Dot", [track("OPACITY", [at(0, 1)])], { timeline: 0 }),
    animated("1:11", "3D", [fade()]),
    animated("1:12", "Hold", [
      track("OPACITY", [at(0, 0, "HOLD", undefined), at(0.3, 1, "CUSTOM_CUBIC_BEZIER", [0.3, 0, 0.2, 1]), at(0.6, 0)]),
    ]),
    {
      id: "1:13",
      name: "Plain",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      childCount: 0,
    },
  );
}
