import type { WebSocket } from "ws";

/** What a peer socket's handshake needs from the owner. */
export interface PeerServices {
  /** bridge.json's token, read for each handshake. */
  token(): string;
  /** The peer proved it: the owner's contract takes the socket. */
  serve(socket: WebSocket): void;
  /** A newer peer proved it: this owner gives the bridge up (S-034). */
  handOver(): void;
}
