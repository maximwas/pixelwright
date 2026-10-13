import { MIXED } from "../schemas/snapshot.ts";
import type { CssContext } from "../types/css.ts";
import type { SnapshotNode, SnapshotPaint } from "../types/snapshot.ts";
import { unwrapVar } from "../utils/css-value.ts";
import { colorCss, type Rgba } from "./color.ts";
import { cssUrl } from "./format.ts";
import { styleTokenName, variableTokenName } from "./tokens.ts";

/** A paint the mapping table cannot write back yet (gradients, video, patterns): read-only CSS instead. */
export const UNMAPPED = Symbol("unmapped");

export type PaintCss = string | typeof UNMAPPED | null;

const SCALE_MODES: Readonly<Record<string, string>> = {
  FILL: "center / cover no-repeat",
  CROP: "center / cover no-repeat",
  FIT: "center / contain no-repeat",
  TILE: "repeat",
};

/**
 * A layer's paints as one CSS value, top layer first: `var(--Name)` for a paint style, the token of a bound variable,
 * else the literal. Null when nothing visible is painted. A style's value goes to the tokens: its paints as core writes
 * them, else (a gradient) the layer's own background as Figma writes it, which a layer with such fills carries.
 */
export function paintsCss(
  paints: SnapshotNode["fills"],
  styleId: string | undefined,
  node: SnapshotNode,
  context: CssContext,
): PaintCss {
  if (paints === undefined) {
    return null;
  }

  if (paints === MIXED) {
    return UNMAPPED;
  }

  const style = styleId === undefined || styleId === MIXED ? undefined : context.styles[styleId];

  if (style?.paints !== undefined) {
    const name = styleTokenName(style);
    const value = layersCss(style.paints, node, context);
    const css = typeof value === "string" ? value : paints === node.fills ? unwrapVar(node.css?.background) : undefined;

    if (css !== undefined) {
      context.tokens.set(name, css);
    }

    return `var(${name})`;
  }

  return layersCss(paints, node, context);
}

function layersCss(paints: readonly SnapshotPaint[], node: SnapshotNode, context: CssContext): PaintCss {
  const layers = paints
    .filter((paint) => paint.visible !== false)
    .toReversed()
    .map((paint) => layerCss(paint, node, context));

  if (layers.length === 0) {
    return null;
  }

  if (layers.some((layer) => layer === UNMAPPED)) {
    return UNMAPPED;
  }

  const values = layers as string[];

  // Only the bottom layer of a CSS background may be a plain color: one above it becomes a flat gradient.
  return values
    .map((value, index) =>
      index < values.length - 1 && isColor(value) ? `linear-gradient(${value}, ${value})` : value,
    )
    .join(", ");
}

function isColor(value: string): boolean {
  return !value.startsWith("url(") && !value.includes("gradient(");
}

function layerCss(paint: SnapshotPaint, node: SnapshotNode, context: CssContext): string | typeof UNMAPPED {
  if (paint.type === "SOLID" && paint.color !== undefined) {
    const variable = boundVariable(paint.boundVariables?.color, context);

    if (variable !== null) {
      const name = variableTokenName(variable);

      if (isRgba(variable.value)) {
        context.tokens.set(name, colorCss(variable.value));
      }

      const opacity = paint.opacity ?? 1;

      // The paint's own opacity on top of the variable's color: mixed with transparent, so it still names the token.
      return opacity < 1
        ? `color-mix(in srgb, var(${name}) ${Math.round(opacity * 100)}%, transparent)`
        : `var(${name})`;
    }

    return colorCss(paint.color, paint.opacity ?? 1);
  }

  if (paint.type === "IMAGE") {
    const url = context.imageUrl?.(node, paint) ?? `assets/${paint.imageHash ?? "image"}.png`;

    return `${cssUrl(url)} ${SCALE_MODES[paint.scaleMode ?? "FILL"] ?? SCALE_MODES.FILL}`;
  }

  return UNMAPPED;
}

/** The variable an alias (`{type: "VARIABLE_ALIAS", id}`) points at, when the snapshot resolved it. */
export function boundVariable(alias: unknown, context: CssContext) {
  if (typeof alias !== "object" || alias === null || !("id" in alias) || typeof alias.id !== "string") {
    return null;
  }

  return context.variables[alias.id] ?? null;
}

function isRgba(value: unknown): value is Rgba {
  return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
}
