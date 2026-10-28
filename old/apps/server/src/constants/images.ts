/** Luminance (0–255) one pixel must differ from its neighbour by to start an edge. */
export const EDGE_STEP = 24;

/** The share of a row or column that must change for it to count as an edge. */
export const EDGE_MIN_SHARE = 0.04;

/** How far apart (px) a reference's edge and a render's may be and still be one edge, shifted. */
export const EDGE_MAX_SHIFT = 12;

/** The most edges each list of an edge diff names. */
export const EDGE_LIST_MAX = 40;

/** How far (0–255) a pixel's colour may differ before it counts as different: antialiasing and colour profiles. */
export const PIXEL_TOLERANCE = 16;

/** The largest reference image read: a full-page screenshot at 2x fits. */
export const REFERENCE_MAX_BYTES = 50 * 1024 * 1024;
