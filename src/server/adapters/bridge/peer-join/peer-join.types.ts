import type { WebSocket } from "ws";

/** The owner's socket once both sides proved the token, or why the try ended: its close code, or null for none. */
export type PeerJoinResult =
  | { readonly socket: WebSocket; readonly closeCode: null }
  | { readonly socket: null; readonly closeCode: number | null };
