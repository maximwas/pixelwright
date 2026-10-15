import { sameValue } from "../../../kernel/equality.ts";
import { MIXED } from "../../../schemas/snapshot-values.ts";
import type { CssContext } from "../../../types/css.ts";
import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import type { PaintSpec, StrokeSpec } from "../../figma-props.ts";
import type { AttributeReader, Rule, WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, splitTop } from "../../values/css-values.ts";
import { px } from "../../values/format.ts";
import { paintOf, paintsCss, UNMAPPED } from "../../values/paints.ts";

/** One side of a stroke: its weight, whether it is dashed, its paint. */
interface Side {
  readonly weight: number;
  readonly dash: boolean;
  readonly paint: PaintSpec;
}

/** A side that could not be read: its error is out already. */
const INVALID = Symbol("invalid");

/** Per-side weights as Figma keeps them, and the CSS side each is. */
const SIDE_WEIGHTS = [
  ["strokeTopWeight", "border-top"],
  ["strokeRightWeight", "border-right"],
  ["strokeBottomWeight", "border-bottom"],
  ["strokeLeftWeight", "border-left"],
] as const;

const SIDES = ["top", "right", "bottom", "left"] as const;
const STROKES = ["border", "border-top", "border-right", "border-bottom", "border-left", "outline"];
const BORDER_STYLES = new Set(["solid", "dashed", "dotted", "none", "hidden"]);

/**
 * A box's strokes: an inside or centred stroke is a border (with box-sizing: border-box it keeps the size), an outside
 * one an outline; per-side weights are a border per side. What the table cannot write yet is read-only.
 */
export function readStrokes(node: SnapshotNode, css: CssDeclarations, context: CssContext): void {
  const color = paintsCss(node.strokes, node.strokeStyleId, node, context);

  if (color === null) {
    return;
  }

  if (color === UNMAPPED) {
    css.readOnly("border", node.css?.border ?? "a gradient or other stroke the table cannot write yet");

    return;
  }

  const line = (weight: number) => `${px(weight)} ${node.dashPattern === undefined ? "solid" : "dashed"} ${color}`;

  if (node.strokeWeight === MIXED) {
    for (const [key, property] of SIDE_WEIGHTS) {
      const weight = node[key] ?? 0;

      if (weight > 0) {
        css.set(property, line(weight));
      }
    }
  } else {
    css.set(node.strokeAlign === "OUTSIDE" ? "outline" : "border", line(node.strokeWeight ?? 1));
  }

  readCentredStroke(node, css);
}

/** A centred stroke paints half of itself outside the layer's box, which a border-box border cannot. */
export function readCentredStroke(node: SnapshotNode, css: CssDeclarations): void {
  if (node.strokeAlign === "CENTER") {
    css.readOnly("stroke-align", "center");
  }
}

/** Borders and the outline written back as the layer's one stroke. */
export const STROKES_RULE: Rule = {
  attributes: STROKES,
  write: strokesRule,
};

/**
 * Figma strokes a layer once, every side in one colour and style. A border or outline in the element resets every
 * side, as the CSS shorthands do; a side alone changes only itself, the others kept from what the layer has.
 */
function strokesRule({ own, merged }: WriteInput, out: WriteOutput): void {
  const read = own("border") !== undefined || own("outline") !== undefined ? own : merged;
  const border = read("border");
  const outline = read("outline");
  const source = STROKES.find((name) => own(name) !== undefined) ?? "border";

  if (border !== undefined && outline !== undefined && border !== "none" && outline !== "none") {
    out.fail("outline", "Figma strokes a layer once: write border (inside) or outline (outside), not both.");

    return;
  }

  const outside = outline !== undefined && outline !== "none";
  const shorthand = outside
    ? (["outline", outline] as const)
    : border === undefined
      ? null
      : (["border", border] as const);
  const sides = sidesOf(read, shorthand, out);

  if (sides === null) {
    return;
  }

  const stroke = strokeOf(sides, outside ? "OUTSIDE" : "INSIDE");

  if (stroke === null) {
    out.fail(
      STROKES.find((name) => name.startsWith("border-") && own(name) !== undefined) ?? source,
      "Figma draws every side of a stroke in one colour and style: give the sides the same ones.",
    );
  } else {
    out.set("strokes", stroke, source);
  }
}

/** Each side: its own attribute, else the shorthand's; null when one could not be read (its error is out). */
function sidesOf(
  read: AttributeReader,
  shorthand: readonly [string, string] | null,
  out: WriteOutput,
): (Side | null)[] | null {
  const all = shorthand === null ? null : sideOf(shorthand[0], shorthand[1], out);
  const sides = SIDES.map((side) => {
    const value = read(`border-${side}`);

    return value === undefined ? all : sideOf(`border-${side}`, value, out);
  });

  return all === INVALID || sides.includes(INVALID) ? null : (sides as (Side | null)[]);
}

/** The one stroke the sides make: none drawn removes it; sides of different colours or styles make none (null). */
function strokeOf(sides: readonly (Side | null)[], align: StrokeSpec["align"]): StrokeSpec | null {
  const drawn = sides.filter((side) => side !== null);
  const [first] = drawn;

  if (first === undefined) {
    return {
      paints: [],
      align,
      dash: false,
    };
  }

  if (drawn.some((side) => side.dash !== first.dash || !sameValue(side.paint, first.paint))) {
    return null;
  }

  const [top = 0, right = 0, bottom = 0, left = 0] = sides.map((side) => side?.weight ?? 0);

  return {
    paints: [first.paint],
    ...(top === right && right === bottom && bottom === left
      ? { weight: top }
      : {
          sides: {
            top,
            right,
            bottom,
            left,
          },
        }),
    align,
    dash: first.dash,
  };
}

/** One side of a border, in any order CSS allows: `1px solid #000`; null when none is drawn. */
function sideOf(attribute: string, value: string, out: WriteOutput): Side | null | typeof INVALID {
  if (value === "none" || value === "0") {
    return null;
  }

  const words = splitTop(value, " ");
  const width = words.find((word) => typeof lengthOf(word) === "number");
  const style = words.find((word) => BORDER_STYLES.has(word));
  const paint = paintOf(words.filter((word) => word !== width && word !== style).join(" "));
  const weight = lengthOf(width ?? "");

  if (style === "none" || style === "hidden" || weight === 0) {
    return null;
  }

  if (typeof weight !== "number" || style === undefined || paint === null) {
    out.fail(attribute, `${attribute}="${value}" is not "Npx solid|dashed <colour or token>".`);

    return INVALID;
  }

  return {
    weight,
    dash: style !== "solid",
    paint,
  };
}
