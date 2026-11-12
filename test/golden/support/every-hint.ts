import * as zod from "zod/mini";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

type Fields = Record<string, unknown> & { id: string; name: string; children?: object[] };

const RED = { type: "SOLID", visible: true, color: { r: 1, g: 0, b: 0 } };
const WHITE = { ...RED, color: { r: 1, g: 1, b: 1 } };
const GRADIENT = {
  type: "GRADIENT_LINEAR",
  visible: true,
  opacity: 1,
  blendMode: "NORMAL",
  gradientStops: [
    { position: 0, color: { r: 0.2314, g: 0.1843, b: 0.851, a: 1 } },
    { position: 1, color: { r: 0.5451, g: 0.3608, b: 0.9647, a: 1 } },
  ],
  gradientTransform: [
    [0.7, 0.7, -0.2],
    [-0.7, 0.7, 0.5],
  ],
};

/** A layer of these fields: a 100×100 frame at its parent's corner unless they say otherwise. */
export function layer(fields: Fields): Record<string, unknown> {
  return {
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    childCount: fields.children?.length ?? 0,
    ...fields,
  };
}

/** A hugging text of one run in Inter Regular 16 with an Auto line height. */
export function textLayer(
  id: string,
  name: string,
  characters: string,
  look: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    name,
    type: "TEXT",
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 20,
    childCount: 0,
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [
        {
          characters,
          start: 0,
          end: characters.length,
          fontName: { family: "Inter", style: "Regular" },
          fontSize: 16,
          fontWeight: 400,
          textDecoration: "NONE",
          textCase: "ORIGINAL",
          lineHeight: { unit: "AUTO" },
          letterSpacing: { unit: "PIXELS", value: 0 },
          fills: [],
          fillStyleId: "",
          textStyleId: "",
          ...look,
        },
      ],
    },
  };
}

/** A grey no style or token has: the structure layers add no raw-colour examples. */
const GREY = { ...RED, color: { r: 0.5, g: 0.5, b: 0.5 } };
const IMAGE = { type: "IMAGE", visible: true, scaleMode: "FILL", imageHash: "abc" };

/** A text of the given resize, with these fields. */
function resized(
  base: Record<string, unknown>,
  resize: string,
  fields: object = {},
): Record<string, unknown> {
  return { ...base, ...fields, text: { ...(base.text as object), textAutoResize: resize } };
}

/** The structure hints' layers (Q-001..Q-007), with ids under the prefix. */
function structureKinds(prefix: string): object[] {
  const items = (first: number, type: string) =>
    [0, 1, 2, 3, 4].map((index) =>
      layer({ id: `${prefix}:${first + index}`, name: "Item", type, width: 40, height: 10, fills: [GREY] }),
    );

  return [
    layer({
      id: `${prefix}:13`,
      name: "Stack by hand",
      layoutMode: "VERTICAL",
      width: 400,
      height: 100,
      children: [0, 1, 2].map((index) =>
        layer({
          id: `${prefix}:${14 + index}`,
          name: "Bar",
          type: "RECTANGLE",
          y: index * 30,
          width: 40,
          height: 20,
          fills: [GREY],
          layoutPositioning: "ABSOLUTE",
        }),
      ),
    }),
    layer({
      id: `${prefix}:17`,
      name: "Row",
      layoutMode: "HORIZONTAL",
      width: 400,
      height: 40,
      children: [
        layer({ id: `${prefix}:18`, name: "Left", type: "RECTANGLE", width: 40, height: 40, fills: [GREY] }),
        layer({ id: `${prefix}:19`, name: "Gap", x: 40, width: 24, height: 40 }),
        layer({ id: `${prefix}:20`, name: "Right", type: "RECTANGLE", x: 64, width: 40, height: 40, fills: [GREY] }),
      ],
    }),
    { ...textLayer(`${prefix}:21`, "Title", "Plans\nand prices"), height: 40 },
    layer({
      id: `${prefix}:22`,
      name: "Dots",
      width: 140,
      height: 40,
      children: [0, 50, 100].map((x, index) =>
        layer({ id: `${prefix}:${23 + index}`, name: "Dot", type: "ELLIPSE", x, width: 40, height: 40, fills: [GREY] }),
      ),
    }),
    resized(textLayer(`${prefix}:26`, "Body", "Every plan includes unlimited projects."), "HEIGHT", {
      width: 240,
      height: 40,
    }),
    layer({
      id: `${prefix}:27`,
      name: "Excerpt",
      clipsContent: true,
      width: 200,
      height: 40,
      children: [resized(textLayer(`${prefix}:28`, "Excerpt text", "A long excerpt"), "HEIGHT", { y: 20, height: 40 })],
    }),
    layer({
      id: `${prefix}:29`,
      name: "Hero",
      type: "RECTANGLE",
      x: 500,
      width: 400,
      height: 200,
      fills: [IMAGE, GRADIENT],
    }),
    layer({
      id: `${prefix}:30`,
      name: "Grain",
      type: "RECTANGLE",
      x: 500,
      width: 400,
      height: 200,
      fills: [{ ...IMAGE, scaleMode: "TILE", scalingFactor: 0.5 }],
    }),
    layer({
      id: `${prefix}:31`,
      name: "Pricing",
      layoutMode: "VERTICAL",
      width: 400,
      children: items(32, "RECTANGLE"),
    }),
    layer({ id: `${prefix}:37`, name: "Menu", layoutMode: "VERTICAL", width: 400, children: items(38, "ELLIPSE") }),
  ];
}

/** Three alike frames of two layers each, built by hand (Q-002). */
function repeated(
  prefix: string,
  name: string,
  types: readonly string[],
): object[] {
  return [1, 2, 3].map((index) =>
    layer({
      id: `${prefix}:${index}`,
      name,
      layoutMode: "HORIZONTAL",
      width: 200,
      height: 40,
      children: types.map((type, place) =>
        layer({ id: `${prefix}:${index}${place}`, name: type, type, width: 20, height: 20, fills: [GREY] }),
      ),
    }),
  );
}

/** One layer or more for each layer hint, with ids under the prefix: a second copy brings the plural wordings. */
function kinds(prefix: string): object[] {
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
        layer({ id: `${prefix}:3`, name: "Backdrop", type: "RECTANGLE", width: 400, height: 200, fills: [WHITE] }),
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
      children: [textLayer(`${prefix}:6`, "Note", "Line one line two")],
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
        { ...textLayer(`I${prefix}:9;2:1`, "Label", "Buy"), width: 40, overrides: ["fills"], missingFont: true },
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

/**
 * 0.7.0's every-hint snapshot as a read model (C-193): a layer or more for each hint design_read gives on its own
 * layers, tokens and Figma's matches, each layer kind twice for the plural wordings, so their words and order are
 * pinned together.
 */
export function everyHintModel(): ReadModel {
  return zod.parse(ReadModelSchema, {
    root: layer({
      id: "1:1",
      name: "Screen",
      layoutMode: "VERTICAL",
      width: 400,
      height: 900,
      children: [
        ...kinds("1"),
        ...kinds("2"),
        ...structureKinds("1"),
        ...structureKinds("2"),
        ...repeated("4", "Plan", ["RECTANGLE", "ELLIPSE"]),
        ...repeated("5", "Tag", ["ELLIPSE", "ELLIPSE"]),
        layer({
          id: "3:1",
          name: "Mark",
          type: "ELLIPSE",
          width: 32,
          height: 32,
          fills: [GRADIENT],
          fillStyleId: "S:4",
        }),
      ],
    }),
    styles: {
      "S:1": { name: "Accent", type: "PAINT", remote: false, paints: [RED] },
      "S:2": { name: "White", type: "PAINT", remote: false, paints: [WHITE] },
      "S:3": { name: "White", type: "PAINT", remote: false, paints: [WHITE], duplicate: 2 },
      "S:4": { name: "Orbit/Gradient", type: "PAINT", remote: false, paints: [GRADIENT] },
    },
    variables: { "V:16": { name: "space/16", collection: "Orbit", resolvedType: "FLOAT", remote: false, value: 16 } },
  });
}
