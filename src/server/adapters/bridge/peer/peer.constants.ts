import { PEER_PATH } from "@/shared/protocol/protocol.constants.ts";

export const OWNER_CLIENT_TEXT = {
  ownerGone:
    "The Pixelwright server that owns the Figma bridge went away before the plugin answered: the outcome is unknown, read the file before you retry.",
} as const;

/** A peer waits the owner's timer plus this, so the owner's TIMEOUT, worded for the op, arrives first (S-032). */
export const PEER_TIMEOUT_MARGIN_MS = 5_000;

export const PEER_BRIDGE_TEXT = {
  timeout: (op: string) => `${op}: the Pixelwright server that owns the Figma bridge did not answer in time`,
} as const;

/** The owner's peer path on this machine. */
export const PEER_URL = { at: (host: string, port: number) => `ws://${host}:${port}${PEER_PATH}` } as const;

/** The client socket's events the peer listens to. */
export const PEER_SOCKET_EVENT = { open: "open", message: "message", close: "close", error: "error" } as const;
