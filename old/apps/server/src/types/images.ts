/** An image as 8-bit RGBA pixels, row by row. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** How the edges along one axis of two images pair up, by position in px. */
export interface EdgeDiff {
  matched: number;
  /** An edge of the reference found nearby in the render: where each is, and by how much the render's is off. */
  shifted: { reference: number; node: number; by: number }[];
  /** Edges of the reference with none near them in the render. */
  missing: number[];
  /** Edges of the render with none near them in the reference. */
  extra: number[];
}

/** A render compared with a reference, pixel by pixel over the part both cover, and by their edges. */
export interface ImageComparison {
  /** Root mean square difference of the colours (0–255), both laid over white. */
  rmse: number;
  /** The share of pixels whose largest colour difference passes PIXEL_TOLERANCE. */
  different: number;
  /** The box around every differing pixel, in px of the render; null when none differs. */
  box: { x: number; y: number; width: number; height: number } | null;
  rows: EdgeDiff;
  columns: EdgeDiff;
}
