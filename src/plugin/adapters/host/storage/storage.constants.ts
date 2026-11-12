/** The clientStorage key of the paired key, 0.7.0's (P-007). */
export const PAIRING_STORAGE_KEY = "pixelwright.pairing";

/** The clientStorage key of one file's Allow edits (P-011): per user, machine and plugin id, so never shared. */
export const EDITS_KEY = { of: (fileId: string) => `pixelwright.allowEdits.${fileId}` } as const;

/** The root plugin-data key that holds a file's own id when Figma gives no fileKey (P-011). */
export const FILE_ID_KEY = "fileId";

/** Base 36 keeps the id short; `Math.random().toString(36)` starts with "0.", so its digits start at 2. */
export const FILE_ID_RADIX = 36;
export const RANDOM_DIGITS_FROM = 2;
