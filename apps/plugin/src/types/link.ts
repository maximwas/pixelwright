import type { PairingReason, PluginInfo, PluginKey, RequestMessage, WireError } from "@pixelwright/core";

/** The browser WebSocket as far as SocketLink uses it, so tests can hand it a fake. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
}

export type RequestOutcome =
  | { readonly ok: true; readonly result: unknown }
  | { readonly ok: false; readonly error: WireError };

export type LinkState =
  | { readonly kind: "connecting" }
  | { readonly kind: "connected"; readonly serverVersion: string }
  | { readonly kind: "pairing"; readonly reason: PairingReason; readonly attemptsLeft: number }
  | { readonly kind: "waiting"; readonly retryInMs: number; readonly reason: string | null }
  | { readonly kind: "stopped"; readonly reason: string };

export interface SocketLinkOptions {
  readonly url: string;
  readonly info: () => PluginInfo;
  /** The key stored by an earlier pairing, or null; only a key issued after the user's code replaces it. */
  readonly key: PluginKey | null;
  readonly onRequest: (request: RequestMessage) => Promise<RequestOutcome>;
  readonly onState: (state: LinkState) => void;
  /** The server issued a key after the user typed the code: keep it. */
  readonly onPaired: (key: PluginKey) => void;
  readonly createSocket?: (url: string) => SocketLike;
  /** Runs a reconnect later; returns how to cancel it. */
  readonly schedule?: (run: () => void, ms: number) => () => void;
  readonly random?: () => number;
}
