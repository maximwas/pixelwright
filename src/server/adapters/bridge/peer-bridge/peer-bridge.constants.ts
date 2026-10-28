/** A peer waits the owner's timer plus this, so the owner's TIMEOUT, worded for the op, arrives first (S-032). */
export const PEER_TIMEOUT_MARGIN_MS = 5_000;

export const PEER_BRIDGE_TEXT = {
  timeout: (op: string) => `${op}: the Pixelwright server that owns the Figma bridge did not answer in time`,
} as const;
