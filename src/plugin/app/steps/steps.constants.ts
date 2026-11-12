export const CONTRACT_TEXT = {
  invalidInput: (op: string, problem: string) => `${op}: invalid input: ${problem}`,
} as const;

export const EDITS_TEXT = {
  disabled:
    "Allow edits is off in the Pixelwright plugin window: turn it on there to let the AI change this file (dryRun checks changes without it).",
  noDryRun: "Allow edits is off in the Pixelwright plugin window: turn it on there to let the AI change this file.",
  execute:
    "Allow edits is off in the Pixelwright plugin window, and plugin code needs it because code can change the file. Reading works with it off: execute's script (pw.<read>) or the read tools (inspect, nodes_find, design_read).",
} as const;

const MS_PER_SECOND = 1000;

export const WATCHDOG_TEXT = {
  timeout: (
    op: string,
    timeoutMs: number,
    write: boolean,
  ) =>
    `${op} did not finish in ${timeoutMs / MS_PER_SECOND} s in the plugin${write ? "; it may still be writing, so check the file before you retry" : ""}`,
} as const;

/** Room for birpc's own frame around the result ({t, i, r}), so the posted frame stays under LIMITS.frameBytes. */
export const FRAME_HEADROOM_BYTES = 256;

/** The most UTF-8 bytes one UTF-16 unit takes: a string this short in units fits without counting (main has no TextEncoder). */
export const UTF8_MAX_UNIT_BYTES = 3;

/** UTF-16 units below these take one and two UTF-8 bytes; the rest take three (a surrogate pair counts six, safely over). */
export const UTF8_ONE_BYTE_BELOW = 0x80;
export const UTF8_TWO_BYTES_BELOW = 0x800;

export const FRAME_TEXT = {
  tooLarge: (op: string, limit: number) =>
    `${op}: the answer is over the ${limit}-byte frame limit; ask for less (a smaller node, a lower depth or a budget)`,
  notSerializable: (op: string) => `${op}: the answer cannot be sent as JSON`,
} as const;
