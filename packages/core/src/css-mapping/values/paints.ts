import { Color, isChannels } from "../../kernel/color/color.ts";
import { styleTokenName, variableTokenName } from "../../kernel/names.ts";
import { MIXED } from "../../schemas/snapshot.ts";
import type { PaintSpec } from "../../types/apply.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotNode, SnapshotPaint } from "../../types/snapshot.ts";
import { tokenOf, unwrapVar } from "./css-values.ts";
import { cssUrl } from "./format.ts";

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

      if (isChannels(variable.value)) {
        context.tokens.set(name, Color.of(variable.value, context.colorSpace).css());
      }

      const opacity = paint.opacity ?? 1;

      // The paint's own opacity on top of the variable's color: mixed with transparent, so it still names the token.
      return opacity < 1
        ? `color-mix(in ${context.colorSpace ?? "srgb"}, var(${name}) ${Math.round(opacity * 100)}%, transparent)`
        : `var(${name})`;
    }

    return Color.of(paint.color, context.colorSpace)
      .faded(paint.opacity ?? 1)
      .css();
  }

  if (paint.type === "IMAGE") {
    const url = context.imageUrl?.(node, paint) ?? `assets/${paint.imageHash ?? "image"}.png`;

    return `${cssUrl(url)} ${SCALE_MODES[paint.scaleMode ?? "FILL"] ?? SCALE_MODES.FILL}`;
  }

  return UNMAPPED;
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
