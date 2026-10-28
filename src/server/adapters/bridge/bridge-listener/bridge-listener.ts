import { createServer, type IncomingMessage, type Server, STATUS_CODES } from "node:http";
import type { Duplex } from "node:stream";
import { inject, injectable } from "@needle-di/core";
import { type WebSocket, WebSocketServer } from "ws";
import { LOGGER } from "../../../../core/ports/logger/logger.port.ts";
import { BRIDGE_PATH, CLOSE_CODE } from "../../../../shared/protocol/protocol.constants.ts";
import { BRIDGE_SETTINGS } from "../bridge.tokens.ts";
import { UPGRADE_GUARD } from "../upgrade-guard/upgrade-guard.tokens.ts";
import type { UpgradeRejection, UpgradeVerdict } from "../upgrade-guard/upgrade-guard.types.ts";
import { CLOSE_GRACE_MS, LISTEN_HOST } from "./bridge-listener.constants.ts";

/**
 * The owner's port (S-001): WebSocket upgrades on 127.0.0.1 only, each decided by the upgrade guard; plain HTTP gets
 * 426. A refused plugin upgrade is kept for the status hint. Closing frees the port first, then says goodbye (S-013).
 */
@injectable()
export class BridgeListener {
  readonly #settings;
  readonly #guard;
  readonly #logger;
  #http: Server | undefined;
  #sockets: WebSocketServer | undefined;
  #port: number | null = null;
  #rejection: UpgradeRejection | null = null;

  constructor(
    settings = inject(BRIDGE_SETTINGS),
    guard = inject(UPGRADE_GUARD),
    logger = inject(LOGGER),
  ) {
    this.#settings = settings;
    this.#guard = guard;
    this.#logger = logger;
  }

  /** The port it listens on; the one it will try before listen(). */
  port(): number {
    return this.#port ?? this.#settings.port;
  }

  /** The last plugin upgrade the guard refused, or null. */
  rejection(): UpgradeRejection | null {
    return this.#rejection;
  }

  /** Takes the port; throws what the system said when it cannot (EADDRINUSE: another program holds it). */
  async listen(): Promise<number> {
    const http = createServer((_request, response) => {
      response.writeHead(426, { "content-type": "text/plain" });
      response.end(STATUS_CODES[426]);
    });

    this.#sockets = new WebSocketServer({ noServer: true });
    http.on("upgrade", (request, socket, head) => this.#upgrade(request, socket, head));
    await new Promise<void>((resolve, reject) => {
      http.once("error", reject);
      http.listen(this.#settings.port, LISTEN_HOST, () => {
        http.off("error", reject);
        resolve();
      });
    });

    const address = http.address();

    this.#http = http;
    this.#port = typeof address === "object" && address !== null ? address.port : this.#settings.port;
    this.#logger.info("bridge listening", {
      component: "bridge",
      url: `ws://${LISTEN_HOST}:${this.#port}${BRIDGE_PATH}`,
    });

    return this.#port;
  }

  /** Frees the port first, so another server can take it at once; open sockets hear 1001, a silent one is cut off. */
  async close(): Promise<void> {
    const http = this.#http;
    const sockets = this.#sockets;

    if (http === undefined || sockets === undefined) {
      return;
    }

    this.#http = undefined;

    const freed = new Promise<void>((resolve) => http.close(() => resolve()));

    http.closeAllConnections();

    const cutOff = setTimeout(() => {
      for (const socket of sockets.clients) {
        socket.terminate();
      }
    }, CLOSE_GRACE_MS);

    for (const socket of sockets.clients) {
      socket.close(CLOSE_CODE.goingAway, "server shutting down");
    }

    await new Promise<void>((resolve) => sockets.close(() => resolve()));
    clearTimeout(cutOff);
    await freed;
  }

  #upgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    // A client that resets mid-upgrade must not take the server down.
    socket.on("error", () => socket.destroy());

    const verdict = this.#guard.check(request, this.port());

    if (verdict.status !== 101) {
      this.#refuse(request, socket, verdict);

      return;
    }

    this.#sockets?.handleUpgrade(request, socket, head, (webSocket) => this.#accept(webSocket));
  }

  /** A plain HTTP error and the socket closed; logged with the reason, the Origin and the Host, never all headers. */
  #refuse(
    request: IncomingMessage,
    socket: Duplex,
    verdict: Exclude<UpgradeVerdict, { status: 101 }>,
  ): void {
    const body = STATUS_CODES[verdict.status] ?? "Error";
    const refused = verdict.status === 403 ? verdict : null;

    this.#logger.warn("bridge refused an upgrade", {
      component: "bridge",
      status: verdict.status,
      role: refused?.role ?? null,
      reason: refused?.rejection.reason ?? "path",
      origin: request.headers.origin ?? null,
      host: request.headers.host ?? null,
    });

    // Only a refused plugin tells something about the setup (the status hint); a refused peer or path does not.
    if (refused?.role === "plugin") {
      this.#rejection = refused.rejection;
    }

    socket.once("finish", () => socket.destroy());
    socket.end(
      `HTTP/1.1 ${verdict.status} ${body}\r\nConnection: close\r\nContent-Type: text/plain\r\n` +
        `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
    );
  }

  /** shortcut: an accepted socket is closed 1011 at once until item 03 runs the plugin handshake on it (07: peers). */
  #accept(socket: WebSocket): void {
    socket.close(CLOSE_CODE.internalError, "the Pixelwright handshake is not built yet");
  }
}
