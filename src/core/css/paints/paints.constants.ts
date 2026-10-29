/** Figma's paint type a solid colour has, and the colour profile whose channels are Display P3 values. */
export const FIGMA_PAINT = { solid: "SOLID", displayP3: "DISPLAY_P3" } as const;

/** A paint the mapping table cannot write back (gradients and images until item 18, diamond, video, patterns). */
export const UNMAPPED_PAINT: unique symbol = Symbol("unmapped paint");

export const PAINTS_NUMBER = {
  /** color-mix() takes the paint's opacity past the variable's alpha as whole percents. */
  percent: 100,
} as const;

export const PAINTS_PATTERN = {
  /** What a custom property's name cannot hold: anything but letters and digits of any script, `_` and `-`. */
  unnamed: /[^\p{L}\p{N}_-]+/gu,
  edgeDashes: /^-+|-+$/g,
  /** A WEB code syntax written as var(--name, …). */
  wrapped: /^var\(\s*(--[^,)\s]+)/,
} as const;

export const PAINTS_VALUE = { dash: "-", none: "", prefix: "--", layerJoint: ", " } as const;

export const PAINTS_TEXT = {
  token: (name: string) => `var(${name})`,
  property: (name: string) => `--${name}`,
  mix: (
    space: string,
    name: string,
    percent: number,
  ) =>
    `color-mix(in ${space}, var(${name}) ${percent}%, transparent)`,
  flat: (color: string) => `linear-gradient(${color}, ${color})`,
} as const;
