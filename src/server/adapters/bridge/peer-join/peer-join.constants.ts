import { PEER_PATH } from "@/shared/protocol/protocol.constants.ts";

/** The owner's peer path on this machine. */
export const PEER_URL = {
  at: (
    host: string,
    port: number,
  ) => `ws://${host}:${port}${PEER_PATH}`,
} as const;

/** The client socket's events the peer listens to. */
export const PEER_SOCKET_EVENT = {
  open: "open",
  message: "message",
  close: "close",
  error: "error",
} as const;
