import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { INTENT_EFFECT } from "@/shared/write-intents/write-intent.constants.ts";

/** Figma's shadow types and its blur that changes across the box. */
export const FIGMA_EFFECT = {
  dropShadow: "DROP_SHADOW",
  innerShadow: "INNER_SHADOW",
  progressive: "PROGRESSIVE",
} as const;

/** Figma's blurs as the CSS property each is, and the `$css` name a progressive one is noted under (C-102). */
export const BLURS: Readonly<Record<string, { readonly property: string; readonly note: string }>> = {
  LAYER_BLUR: { property: CSS_PROPERTY.filter, note: "blur" },
  BACKGROUND_BLUR: { property: CSS_PROPERTY.backdropFilter, note: "backdrop-blur" },
};

/** Effects CSS has no property for: the layer is rendered as an image (0.7.0 made it an Image asset). */
export const RENDERED_EFFECTS: Readonly<Record<string, true>> = { NOISE: true, TEXTURE: true, GLASS: true };

export const EFFECTS_NUMBER = {
  /**
   * CSS's blur() per px of Figma's blur radius (C-100, m:734ea40e): Figma renders a radius R as a Gaussian of about
   * 0.43 R (measured on layer and background blurs of radius 4 to 40 against Chrome); Dev Mode's R / 2 is softer.
   */
  blurPerRadius: 0.43,
  /**
   * box-shadow's blur radius is twice the Gaussian's standard deviation (CSS Backgrounds 3), and drop-shadow() takes the
   * deviation itself (Filter Effects 1): a shadow drawn as drop-shadow() halves Figma's radius to keep its look.
   */
  radiusPerDeviation: 2,
  /** A fill's full opacity and alpha: such a solid fill hides what is under the box. */
  opaque: 1,
  percent: 100,
} as const;

/** Where a progressive blur starts and ends when Figma leaves its offsets out: top centre to bottom centre. */
export const PROGRESSIVE_ENDS = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;

export const EFFECTS_VALUE = {
  inset: "inset",
  space: " ",
  joint: ", ",
  zero: "0",
  effect: "effect",
  /** A drop shadow Figma shows behind the layer that stays a box-shadow, which CSS cuts out under the box. */
  behind: "shadow-behind",
} as const;

export const EFFECTS_TEXT = {
  blur: (length: string) => `blur(${length})`,
  dropShadow: (shadow: string) => `drop-shadow(${shadow})`,
  px: (value: number) => `${value}px`,
  at: (x: number, y: number) => `${x}% ${y}%`,
  progressive: (
    from: string,
    start: string,
    to: string,
    end: string,
  ) =>
    `progressive from ${from} at ${start} to ${to} at ${end}`,
  rendered: (type: string) => `${type.toLowerCase()}: CSS has none, the layer reads as an image`,
} as const;

export const EFFECTS_ATTRIBUTES = [
  CSS_PROPERTY.boxShadow,
  CSS_PROPERTY.textShadow,
  CSS_PROPERTY.filter,
  CSS_PROPERTY.backdropFilter,
];
export const EFFECTS_SOURCES = ["effects", "effectStyleId", "fills"];

/** The blurs CSS writes back, as the filter each is and Figma's effect. */
export const BLUR_WRITES = [
  [CSS_PROPERTY.filter, INTENT_EFFECT.LAYER_BLUR],
  [CSS_PROPERTY.backdropFilter, INTENT_EFFECT.BACKGROUND_BLUR],
] as const;

/** The effects CSS writes; a merge keeps every other one (noise, texture, glass) where it was (O-015). */
export const CSS_EFFECTS: Readonly<Record<string, true>> = Object.fromEntries(
  Object.values(INTENT_EFFECT).map((type) => [type, true]),
);

export const EFFECTS_WRITE = {
  none: "none",
  /** A shadow is x y, then its blur and spread if given. */
  minLengths: 2,
  maxLengths: 4,
  /** Four decimals of a blur radius, as 0.7.0 rounded CSS's blur() over 0.43. */
  radiusScale: 10_000,
  /** An effect's look is compared at a thousandth of a px, and its colour in whole bytes. */
  keyScale: 1_000,
  byte: 255,
  boundColor: "color",
} as const;

export const EFFECTS_PATTERN = { blur: /^blur\(\s*(\d*\.?\d+)px\s*\)$/ } as const;

/** The effects' refusals, with 0.7.0's words (C-104..C-106). */
export const EFFECTS_ERROR = {
  holdsEvery: (token: string, shadows: boolean) =>
    `The effect style ${token} holds every effect: change the style, or write its ${shadows ? "shadows" : "blur"} out.`,
  notBlur: (attribute: string, value: string) => `${attribute}="${value}" is not blur(Npx), the one filter Figma has.`,
  notShadow: (shadow: string) => `"${shadow}" is not a shadow: [inset] x y [blur] [spread] and a colour.`,
  shareOfVariable: (token: string) =>
    `A shadow's colour variable is its whole colour, its alpha too: write var(${token}) alone, or the colour with that alpha as a value.`,
} as const;

/**
 * Where Figma draws a shadow's spread (FIX-090A; Plugin API DropShadowEffect.spread, probed in Test MCP 2026-11-14): on
 * these types always, and on these only when they clip their content and have a visible fill. Elsewhere it keeps the
 * spread and draws none, an inner shadow's too.
 */
export const SPREAD_DRAWN: { readonly always: readonly string[]; readonly clipped: readonly string[] } = {
  always: ["RECTANGLE", "ELLIPSE"],
  clipped: ["FRAME", "COMPONENT", "INSTANCE"],
};
