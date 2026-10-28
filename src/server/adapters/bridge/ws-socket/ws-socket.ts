import type { RawData, WebSocket } from "ws";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import type { Logger } from "@/core/ports/logger/logger.port.ts";
import { WS_EVENT, WS_LOG } from "@/server/adapters/bridge/ws-socket/ws-socket.constants.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";

/**
 * The server's MessageSocket over a ws WebSocket (Adapter), with the heartbeat (S-007): any frame or pong counts as
 * alive, and a socket that gave neither since the last ping is terminated, which ends it at once. That catches frozen
 * windows, sleep and half-open sockets, whose close would otherwise never come.
 */
export class WsSocket implements MessageSocket {
  readonly #socket: WebSocket;
  readonly #logger: Logger;
  #alive = true;

  constructor(
    socket: WebSocket,
    logger: Logger,
  ) {
    this.#socket = socket;
    this.#logger = logger;
  }

  /** Starts the heartbeat, and keeps a socket error from taking the server down: the close that follows cleans up. */
  watch(intervalMs: number): void {
    const heartbeat = setInterval(() => this.#beat(), intervalMs);

    heartbeat.unref();
    this.#socket.on(WS_EVENT.pong, () => this.#hear());
    this.#socket.on(WS_EVENT.message, () => this.#hear());
    this.#socket.on(WS_EVENT.close, () => clearInterval(heartbeat));
    this.#socket.on(WS_EVENT.error, (error) =>
      this.#logger.warn(WS_LOG.error, {
        component: LOG_COMPONENT.bridge,
        err: error,
      }),
    );
  }

  send(text: string): void {
    this.#socket.send(text);
  }

  close(
    code: number,
    reason: string,
  ): void {
    this.#socket.close(code, reason);
  }

  onMessage(listener: (text: string | null) => void): void {
    this.#socket.on(WS_EVENT.message, (data: RawData, isBinary: boolean) => listener(isBinary ? null : String(data)));
  }

  onClose(listener: (code: number, reason: string) => void): void {
    this.#socket.on(WS_EVENT.close, (code: number, reason: Buffer) => listener(code, String(reason)));
  }

  #hear(): void {
    this.#alive = true;
  }

  #beat(): void {
    if (!this.#alive) {
      this.#logger.info(WS_LOG.silent, { component: LOG_COMPONENT.bridge });
      this.#socket.terminate();

      return;
    }

    this.#alive = false;
    this.#socket.ping();
  }
}
