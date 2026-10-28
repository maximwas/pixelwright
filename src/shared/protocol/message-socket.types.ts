/**
 * One bridge WebSocket as both handshakes see it (A§3): text frames out and in, and the close. The server's adapter is
 * WsSocket over ws; the plugin window's is BrowserSocket over the browser's WebSocket.
 */
export interface MessageSocket {
  send(text: string): void;
  close(code: number, reason: string): void;
  /** Every frame that arrives; null for a binary one, which the protocol never sends. */
  onMessage(listener: (text: string | null) => void): void;
  /** Once, when the socket has closed, whichever side closed it, with the close code. */
  onClose(listener: (code: number) => void): void;
}
