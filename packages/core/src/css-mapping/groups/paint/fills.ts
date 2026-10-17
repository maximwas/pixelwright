import type { CssContext } from "../../../types/css.ts";
import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import type { PaintSpec } from "../../figma-props.ts";
import type { Rule, WriteOutput } from "../../property-group.ts";
import { imageOf, splitTop } from "../../values/css-values.ts";
import { gradientOf } from "../../values/gradient-parse.ts";
import { paintOf, paintsCss, styleIdOf, UNMAPPED } from "../../values/paints.ts";

/** A box's fills as its background, top layer first; what the table cannot write yet is read-only. */
export function readBackground(node: SnapshotNode, css: CssDeclarations, context: CssContext): void {
  const background = paintsCss(node.fills, styleIdOf(node.fillStyleId), node, context);

  if (background === UNMAPPED) {
    css.readOnly("background", node.css?.background ?? "a gradient or other fill the table cannot write yet");
  } else if (background !== null) {
    css.set("background", background);
  }
}

/** A box's background written back as its fills. */
export const BACKGROUND_RULE: Rule = {
  attributes: ["background"],
  write: paintRule("background", "fills"),
};

/** A text's colour written back as its fills. */
export const TEXT_COLOR_RULE: Rule = {
  attributes: ["color"],
  write: paintRule("color", "textFills"),
};

function paintRule(attribute: "background" | "color", key: "fills" | "textFills"): Rule["write"] {
  return ({ own }, out) => {
    const layers = layersOf(attribute, own(attribute) ?? "", out);

    if (layers !== null) {
      out.set(key, layers, attribute);
    }
  };
}

/** Paint layers, top first in CSS and bottom first in Figma; null once one of them is an error. */
function layersOf(attribute: string, value: string, out: WriteOutput): PaintSpec[] | null {
  if (value === "none" || value === "transparent") {
    return [];
  }

  const layers: PaintSpec[] = [];

  for (const layer of splitTop(value, ",")) {
    const paint = layerOf(attribute, layer, value, out);

    if (paint === null) {
      return null;
    }

    layers.push(paint);
  }

  return layers.toReversed();
}

/**
 * One paint layer: a colour or a token (a flat gradient is its colour), or on a background an image file with
 * design_read's fit (cover is FILL, contain FIT, a repeat TILE). Anything else is the attribute's error: null.
 */
function layerOf(attribute: string, layer: string, value: string, out: WriteOutput): PaintSpec | null {
  const paint = colourLayer(layer);

  if (paint !== null) {
    return paint;
  }

  const gradient = attribute === "background" ? gradientOf(layer) : null;

  if (gradient !== null) {
    return gradient;
  }

  const image = imageOf(layer);

  if (image !== null && image !== "unquoted" && attribute === "background") {
    return {
      kind: "image",
      src: image.src,
      scaleMode: image.rest.includes("contain") ? "FIT" : /(^|\s)repeat(\s|$)/.test(image.rest) ? "TILE" : "FILL",
    };
  }

  const [message, hint] = refusal(attribute, layer, value, image);

  out.fail(attribute, message, hint);

  return null;
}

/** A colour or a token, or a flat gradient (one colour twice), as its paint. */
function colourLayer(layer: string): PaintSpec | null {
  const stops = /^linear-gradient\((.+)\)$/s.exec(layer)?.[1];
  const flat = stops === undefined ? null : splitTop(stops, ",");

  return flat !== null && flat.length === 2 && flat[0] === flat[1] ? paintOf(flat[0] ?? "") : paintOf(layer);
}

/** Why a layer cannot be written, and what to do instead. */
function refusal(
  attribute: string,
  layer: string,
  value: string,
  image: ReturnType<typeof imageOf>,
): [string, string | undefined] {
  if (image === "unquoted") {
    return [
      `${layer.slice(0, 40)}: url() without quotes cannot hold spaces, quotes, brackets or var().`,
      'Write the file in quotes: url("my photo.png").',
    ];
  }

  if (image !== null) {
    return ["A text is coloured with paint, not an image.", "Use a colour or a token."];
  }

  if (layer.includes("gradient(")) {
    return attribute === "background"
      ? [
          `${layer.slice(0, 40)}…: this gradient is not written.`,
          "Write linear-, radial- or conic-gradient() with colours or tokens in their stops (no repeating ones).",
        ]
      : ["A text is coloured with a colour or a token, not a gradient.", "Use a colour or a token."];
  }

  return [
    `${attribute}="${value}" is not a colour, a token or color-mix(in srgb, var(--x) N%, transparent) (in display-p3 in a Display P3 file).`,
    undefined,
  ];
}
