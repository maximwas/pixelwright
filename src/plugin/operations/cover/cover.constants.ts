/**
 * How the cover reads a layer (T-073): the types whose own fill covers their box, the blurs that change what is under a
 * layer or the layer itself, and the blends that show a layer as it is.
 */
export const COVER = {
  filled: ["FRAME", "COMPONENT", "INSTANCE", "SECTION", "RECTANGLE"] as readonly string[],
  blurs: ["LAYER_BLUR", "BACKGROUND_BLUR"] as readonly string[],
  blends: ["NORMAL", "PASS_THROUGH"] as readonly string[],
  normal: "NORMAL",
  solid: "SOLID",
  /** A turn this small is float noise, not a rotation. */
  turnDegrees: 0.001,
  /** Float noise in Figma's boxes: a region this far past an edge still lies within. */
  edgePx: 0.01,
} as const;

export const COVER_TEXT = {
  noBox: (id: string, type: string) => `${id} is a ${type.toLowerCase()}, which has no box to clip.`,
} as const;
