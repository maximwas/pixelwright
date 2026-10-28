export const RUNNER_TEXT = {
  unknownOp: (op: string) => `${op}: this plugin has no such op; update the plugin and the server together`,
} as const;

/**
 * Figma's words when its sandbox has spent its callback ids (P-023): it numbers host callbacks in 16 bits and never
 * reuses one; every grid track read takes new ones, so after about 65,536 only grid reads and writes fail.
 */
export const CALLBACKS_SPENT = /Attempted to invoke callback with invalid id/;

export const ERROR_TEXT = {
  reopen: (message: string) =>
    `${message}. Figma's plugin sandbox has run out of callback ids in this long-open plugin window, so it can no longer read or write a grid's tracks: close and reopen the Pixelwright plugin window, then try again. The file is not affected.`,
} as const;
