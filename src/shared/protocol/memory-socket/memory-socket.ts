import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";

/**
 * A MessageSocket whose other end is a test (A§10.2): it keeps what was sent and how it was closed, and delivers the
 * other end's frames and its close. Our own port in memory, so the handshakes run without a network; nothing Figma.
 * A pair links two of them, so both handshakes, the plugin window's and the server's, talk to each other.
 */
export class MemorySocket implements MessageSocket {
  readonly sent: Record<string, unknown>[] = [];
  /** How this end closed it; the close event itself waits for the other end, which may never answer. */
  closed: {
    readonly code: number;
    readonly reason: string;
  } | null = null;

  #onMessage: (text: string | null) => void = () => {};
  #onClose: (code: number, reason: string) => void = () => {};

  #peer: MemorySocket | null = null;

  /** Two linked ends: what one sends the other receives, and a close reaches both, as a WebSocket's does. */
  static pair(): readonly [MemorySocket, MemorySocket] {
    const left = new MemorySocket();
    const right = new MemorySocket();

    left.#peer = right;
    right.#peer = left;

    return [left, right];
  }

  send(text: string): void {
    if (this.closed === null) {
      this.sent.push(JSON.parse(text));
      this.#peer?.receive(text);
    }
  }

  close(
    code: number,
    reason: string,
  ): void {
    const peer = this.#peer;

    if (this.closed !== null) {
      return;
    }

    this.closed = {
      code,
      reason,
    };

    if (peer !== null && peer.closed === null) {
      peer.closed = this.closed;
      peer.hangUp(code, reason);
      this.hangUp(code, reason);
    }
  }

  onMessage(listener: (text: string | null) => void): void {
    this.#onMessage = listener;
  }

  onClose(listener: (code: number, reason: string) => void): void {
    this.#onClose = listener;
  }

  /** A frame from the other end: an object goes as its JSON, a string as it is, null as a binary frame. */
  receive(frame: unknown): void {
    this.#onMessage(typeof frame === "string" || frame === null ? frame : JSON.stringify(frame));
  }

  /** The close event: the other end answered the close, or went away. */
  hangUp(
    code: number,
    reason = "",
  ): void {
    this.#onClose(code, reason);
  }

  /** The last frame sent, or an empty object. */
  last(): Record<string, unknown> {
    return this.sent.at(-1) ?? {};
  }
}
