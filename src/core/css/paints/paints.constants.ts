/** Figma's paint types a solid colour and an image have, and the colour profile whose channels are Display P3 values. */
export const FIGMA_PAINT = { solid: "SOLID", image: "IMAGE", displayP3: "DISPLAY_P3" } as const;

/** A paint the mapping table cannot write back: a diamond or turned gradient, a video, a pattern. */
export const UNMAPPED_PAINT: unique symbol = Symbol("unmapped paint");

export const PAINTS_NUMBER = {
  /** color-mix() takes the paint's opacity past the variable's alpha as whole percents. */
  percent: 100,
} as const;

/** `boundColor`: the field of a paint's bound variables that holds its colour's alias. */
export const PAINTS_VALUE = { none: "", layerJoint: ", ", image: "image", boundColor: "color" } as const;

/** C-082: an image as CSS sizes and repeats it per Figma scale mode; FILL and CROP cover (the crop itself is lost). */
export const IMAGE_COVER = "center / cover no-repeat";
export const IMAGE_SCALE: Readonly<Record<string, string>> = {
  FILL: IMAGE_COVER,
  CROP: IMAGE_COVER,
  FIT: "center / contain no-repeat",
  TILE: "repeat",
};

export const PAINTS_TEXT = {
  token: (name: string) => `var(${name})`,
  mix: (
    space: string,
    name: string,
    percent: number,
  ) =>
    `color-mix(in ${space}, var(${name}) ${percent}%, transparent)`,
  flat: (color: string) => `linear-gradient(${color}, ${color})`,
  /** shortcut: the image's file by its hash until the asset item plans image files and their names. */
  asset: (hash: string) => `assets/${hash}.png`,
  image: (url: string, scale: string) => `${url} ${scale}`,
} as const;
