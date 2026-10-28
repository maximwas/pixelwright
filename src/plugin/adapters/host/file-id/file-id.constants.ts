/** The root plugin-data key that holds a file's own id when Figma gives no fileKey (P-011). */
export const FILE_ID_KEY = "fileId";

/** Base 36 keeps the id short; `Math.random().toString(36)` starts with "0.", so its digits start at 2. */
export const FILE_ID_RADIX = 36;
export const RANDOM_DIGITS_FROM = 2;
