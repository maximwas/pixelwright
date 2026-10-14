import type { Snapshot, SnapshotNode } from "../../src/index.ts";
import { layer, textLayer } from "./layers.ts";

const RED = {
  type: "SOLID",
  visible: true,
  color: {
    r: 1,
    g: 0,
    b: 0,
  },
};
const GRADIENT = {
  type: "GRADIENT_LINEAR",
  visible: true,
  opacity: 1,
  blendMode: "NORMAL",
  gradientStops: [
    {
      position: 0,
      color: {
        r: 0.2314,
        g: 0.1843,
        b: 0.851,
        a: 1,
      },
    },
    {
      position: 1,
      color: {
        r: 0.5451,
        g: 0.3608,
        b: 0.9647,
        a: 1,
      },
    },
  ],
  gradientTransform: [
    [0.7, 0.7, -0.2],
    [-0.7, 0.7, 0.5],
  ],
};
const WHITE = {
  ...RED,
  color: {
    r: 1,
    g: 1,
    b: 1,
  },
};

/**
 * A screen with a layer or more for each hint design_read gives on its own layers, tokens and Figma's matches, so
 * their words and their order are pinned together: unnamed layers, a frame placed by hand over a backdrop rectangle,
 * a bare wrapper, a soft line break, a centred stroke, a detached frame wider than its room, an overridden text in an
 * instance with its font missing, a numbered style, raw colours equal to styles, a gap Figma matches to a token, and a
 * paint style no CSS can give; each layer kind twice, for the plural wordings.
 */
/** One layer or more for each layer hint, with ids under the prefix: a second copy brings the plural wordings. */
function kinds(prefix: string): SnapshotNode[] {
  return [
    layer({
      id: `${prefix}:2`,
      name: "Frame 12",
      width: 400,
      height: 200,
      inferredLayout: {
        layoutMode: "VERTICAL",
        itemSpacing: 8,
        paddingTop: 10,
        paddingLeft: 10,
        counterAxisAlignItems: "CENTER",
      },
      children: [
        layer({
          id: `${prefix}:3`,
          name: "Backdrop",
          type: "RECTANGLE",
          width: 400,
          height: 200,
          fills: [WHITE],
        }),
        layer({
          id: `${prefix}:4`,
          name: "Rectangle 7",
          type: "RECTANGLE",
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          fills: [RED],
        }),
      ],
    }),
    layer({
      id: `${prefix}:5`,
      name: "Wrapper",
      width: 200,
      height: 40,
      children: [textLayer(`${prefix}:6`, "Note", [["Line one\u2028line two"]])],
    }),
    layer({
      id: `${prefix}:7`,
      name: "Card",
      type: "RECTANGLE",
      width: 120,
      height: 80,
      fills: [WHITE],
      strokes: [RED],
      strokeWeight: 1,
      strokeAlign: "CENTER",
    }),
    layer({
      id: `${prefix}:8`,
      name: "Detached card",
      layoutMode: "HORIZONTAL",
      width: 500,
      height: 60,
      detached: true,
    }),
    layer({
      id: `${prefix}:9`,
      name: "Button",
      type: "INSTANCE",
      layoutMode: "HORIZONTAL",
      width: 120,
      height: 40,
      children: [
        {
          ...textLayer(`I${prefix}:9;2:1`, "Label", [["Buy"]]),
          width: 40,
          overrides: ["fills"],
          missingFont: true,
        },
      ],
    }),
    layer({
      id: `${prefix}:10`,
      name: "Stack",
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      width: 400,
      height: 100,
      inferred: { itemSpacing: "V:16" },
      children: [
        layer({
          id: `${prefix}:11`,
          name: "Swatch",
          type: "RECTANGLE",
          width: 40,
          height: 40,
          fills: [WHITE],
          fillStyleId: "S:3",
        }),
        layer({
          id: `${prefix}:12`,
          name: "Dot",
          type: "ELLIPSE",
          width: 40,
          height: 40,
          fills: [RED],
          fillStyleId: "S:1",
        }),
      ],
    }),
  ];
}

export function everyHintSnapshot(): Snapshot {
  const children = [
    ...kinds("1"),
    ...kinds("2"),
    layer({
      id: "3:1",
      name: "Mark",
      type: "ELLIPSE",
      width: 32,
      height: 32,
      fills: [GRADIENT],
      fillStyleId: "S:4",
    }),
  ];

  return {
    root: layer({
      id: "1:1",
      name: "Screen",
      layoutMode: "VERTICAL",
      width: 400,
      height: 900,
      children,
    }),
    styles: {
      "S:1": {
        name: "Accent",
        type: "PAINT",
        remote: false,
        paints: [RED],
      },
      "S:2": {
        name: "White",
        type: "PAINT",
        remote: false,
        paints: [WHITE],
      },
      "S:3": {
        name: "White",
        type: "PAINT",
        remote: false,
        paints: [WHITE],
        duplicate: 2,
      },
      "S:4": {
        name: "Orbit/Gradient",
        type: "PAINT",
        remote: false,
        paints: [GRADIENT],
      },
    },
    variables: {
      "V:16": {
        name: "space/16",
        collection: "Orbit",
        resolvedType: "FLOAT",
        remote: false,
        value: 16,
      },
    },
  };
}
