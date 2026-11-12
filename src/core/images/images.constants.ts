/** The format names an image sniffer gives, as image-size spells them. */
export const IMAGE_FORMAT = { png: "png" } as const;

/** What an added alpha channel holds where the image has pixels: fully opaque at the image's depth; white's channels. */
export const PIXEL = { deepBits: 16, opaque: 0xff, opaqueDeep: 0xff_ff, white: 0xff } as const;

/** 8-bit RGBA, as pixel comparisons and the WebP encoder take it: three colours, then the alpha. */
export const RGBA_LAYOUT = { channels: 4, colours: 3, depth: 8 } as const;

/** image_compare's rmse is given to 2 decimals (T-089). */
export const ROUNDING = { rmse: 100 } as const;

/** Rec. 709 luminance: how much red, green and blue each weigh in how light a pixel looks. */
export const LUMINANCE = [0.2126, 0.7152, 0.0722] as const;

/** The edge diff's numbers (S-094), tuned by hand on real screens in 0.7.0; the bell regression pins them. */
export const EDGE = {
  /** Luminance (0-255) one pixel must differ from its neighbour by to start an edge. */
  step: 24,
  /** The share of a row or column that must step for it to count as an edge. */
  minShare: 0.04,
  /** How far apart (px) a reference's edge and a render's may be and still be one edge, shifted. */
  maxShift: 12,
  /** The most edges each list names. */
  listMax: 40,
} as const;

/** The two ways edges run: rows (horizontal, by y) and columns (vertical, by x). */
export const EDGE_AXIS = { rows: "rows", columns: "columns" } as const;
