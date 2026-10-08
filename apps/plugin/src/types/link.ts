import type { PluginInfo, RequestMessage, WireError } from "@pixelwright/core";

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
  | { readonly kind: "waiting"; readonly retryInMs: number }
  | { readonly kind: "stopped"; readonly reason: string };

export interface SocketLinkOptions {
  readonly url: string;
  readonly info: () => PluginInfo;
  readonly onRequest: (request: RequestMessage) => Promise<RequestOutcome>;
  readonly onState: (state: LinkState) => void;
  readonly createSocket?: (url: string) => SocketLike;
  readonly schedule?: (run: () => void, ms: number) => void;
  readonly random?: () => number;
}
