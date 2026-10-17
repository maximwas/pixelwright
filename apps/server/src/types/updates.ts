export interface LatestVersionOptions {
  /** latest.json, shared by every session on the computer. */
  readonly file: string;
  /** PIXELWRIGHT_NO_UPDATE_CHECK turns the check off: npm is never asked. */
  readonly enabled: boolean;
  readonly now?: () => number;
  readonly fetch?: typeof globalThis.fetch;
}
