import { type Channels, Color, isChannels } from "../../kernel/color/color.ts";
import { styleTokenName, variableTokenName } from "../../kernel/names.ts";
import { MIXED } from "../../schemas/snapshot-values.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotNode, SnapshotPaint } from "../../types/snapshot.ts";
import type { PaintSpec } from "../figma-props.ts";
import { tokenOf, unwrapVar } from "./css-values.ts";
import { cssUrl } from "./format.ts";
import { gradientCss } from "./gradient-css.ts";

/** A paint the mapping table cannot write back (a diamond gradient, video, patterns): read-only CSS instead. */
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
    .filter((paint) => paint.visible ?? true)
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

/** A style id the layer really uses: none for an empty id, or mixed ones (a text's runs). */
export function styleIdOf(id: string | undefined): string | undefined {
  return id === undefined || id === "" || id === MIXED ? undefined : id;
}

/** The variable an alias (`{type: "VARIABLE_ALIAS", id}`) points at, when the snapshot resolved it. */
export function boundVariable(alias: unknown, context: CssContext) {
  if (typeof alias !== "object" || alias === null || !("id" in alias) || typeof alias.id !== "string") {
    return null;
  }

  return context.variables[alias.id] ?? null;
}

/** A paint: a colour, a token, or a token mixed with transparent at an opacity (how design_read writes those). */
export function paintOf(value: string): PaintSpec | null {
  const token = tokenOf(value);

  if (token !== null) {
    return {
      kind: "token",
      token: token.token,
      opacity: 1,
    };
  }

  const mixed =
    /^color-mix\(\s*in\s+(?:srgb|display-p3)\s*,\s*var\(\s*(--[^)\s]+)\s*\)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/.exec(
      value.trim(),
    );

  if (mixed?.[1] !== undefined) {
    return {
      kind: "token",
      token: mixed[1],
      opacity: Number(mixed[2]) / 100,
    };
  }

  const color = Color.parse(value);

  return color === null
    ? null
    : {
        kind: "color",
        color: color.value(),
      };
}

function layerCss(paint: SnapshotPaint, node: SnapshotNode, context: CssContext): string | typeof UNMAPPED {
  if (paint.type === "SOLID" && paint.color !== undefined) {
    return solidCss(paint, paint.color, context);
  }

  if (paint.type.startsWith("GRADIENT_")) {
    return gradientCss(paint, node, context) ?? UNMAPPED;
  }

  if (paint.type === "IMAGE") {
    const url = context.imageUrl?.(node, paint) ?? `assets/${paint.imageHash ?? "image"}.png`;

    return `${cssUrl(url)} ${SCALE_MODES[paint.scaleMode ?? "FILL"] ?? SCALE_MODES.FILL}`;
  }

  return UNMAPPED;
}

/**
 * A solid paint: the token of the colour variable bound to it (an opacity past the variable's own alpha on top as a
 * mix with transparent, so it still names the token), else its colour. Figma keeps a bound paint's opacity as the
 * whole of it: the variable's alpha when bound (seen live on 2026-10-17), less when lowered after.
 */
function solidCss(paint: SnapshotPaint, color: Channels, context: CssContext): string {
  const variable = boundVariable(paint.boundVariables?.color, context);
  const opacity = paint.opacity ?? 1;

  if (variable === null) {
    return Color.of(color, context.colorSpace).faded(opacity).css();
  }

  const name = variableTokenName(variable);
  const alpha = isChannels(variable.value) ? (variable.value.a ?? 1) : 1;
  const extra = alpha > 0 ? opacity / alpha : opacity;

  if (isChannels(variable.value)) {
    context.tokens.set(name, Color.of(variable.value, context.colorSpace).css());
  }

  return Math.round(extra * 100) < 100
    ? `color-mix(in ${context.colorSpace ?? "srgb"}, var(${name}) ${Math.round(extra * 100)}%, transparent)`
    : `var(${name})`;
}
