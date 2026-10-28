/** The part of a browser WebSocket oRPC's RPCLink uses. */
export type BrowserSocket = Pick<
  globalThis.WebSocket,
  "addEventListener" | "removeEventListener" | "send" | "readyState"
>;
