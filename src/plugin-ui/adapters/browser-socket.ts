import { SOCKET_EVENT } from "@/plugin-ui/adapters/adapters.constants.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";

/**
 * The window's MessageSocket over the browser's WebSocket (Adapter, A§3). A browser socket throws on a send before it
 * is open, so what is sent before then waits and goes out on open; a socket that never opens just closes.
 */
export class BrowserSocket implements MessageSocket {
  readonly #socket: WebSocket;
  #waiting: string[] | null = [];

  constructor(socket: WebSocket) {
    this.#socket = socket;
  }

  /** Sends what waited once the socket opens. */
  watch(): void {
    this.#socket.addEventListener(SOCKET_EVENT.open, () => this.#opened());
  }

  send(text: string): void {
    if (this.#waiting === null) {
      this.#socket.send(text);
    } else {
      this.#waiting.push(text);
    }
  }

  close(code: number, reason: string): void {
    this.#socket.close(code, reason);
  }

  onMessage(listener: (text: string | null) => void): void {
    this.#socket.addEventListener(SOCKET_EVENT.message, (event) =>
      listener(typeof event.data === "string" ? event.data : null),
    );
  }

  onClose(listener: (code: number, reason: string) => void): void {
    this.#socket.addEventListener(SOCKET_EVENT.close, (event) => listener(event.code, event.reason));
  }

  #opened(): void {
    const waiting = this.#waiting ?? [];

    this.#waiting = null;

    for (const text of waiting) {
      this.#socket.send(text);
    }
  }
}
