import type { WebSocket } from "ws";
import type { OwnerClient } from "@/server/adapters/bridge/owner-client/owner-client.ts";

/** The owner a peer joined: its client and its socket; closing the socket ends its status stream. */
export interface JoinedOwner {
  readonly client: OwnerClient;
  readonly socket: WebSocket;
}
