import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

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
  percent: 100,
} as const;

/** Where a progressive blur starts and ends when Figma leaves its offsets out: top centre to bottom centre. */
export const PROGRESSIVE_ENDS = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;

export const EFFECTS_VALUE = { inset: "inset", space: " ", joint: ", ", zero: "0", effect: "effect" } as const;

export const EFFECTS_TEXT = {
  blur: (length: string) => `blur(${length})`,
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
export const EFFECTS_SOURCES = ["effects", "effectStyleId"];
