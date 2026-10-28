/** Room for birpc's own frame around the result ({t, i, r}), so the posted frame stays under LIMITS.frameBytes. */
export const FRAME_HEADROOM_BYTES = 256;

/** The most UTF-8 bytes one UTF-16 unit takes: a string this short in units fits without counting (main has no TextEncoder). */
export const UTF8_MAX_UNIT_BYTES = 3;

/** UTF-16 units below these take one and two UTF-8 bytes; the rest take three (a surrogate pair counts six, safely over). */
export const UTF8_ONE_BYTE_BELOW = 0x80;
export const UTF8_TWO_BYTES_BELOW = 0x800;

export const FRAME_TEXT = {
  tooLarge: (
    op: string,
    limit: number,
  ) =>
    `${op}: the answer is over the ${limit}-byte frame limit; ask for less (a smaller node, a lower depth or a budget)`,
  notSerializable: (op: string) => `${op}: the answer cannot be sent as JSON`,
} as const;
