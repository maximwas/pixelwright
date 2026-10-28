import { createServer, type IncomingMessage, type Server, STATUS_CODES } from "node:http";
import type { Duplex } from "node:stream";
import { inject, injectable } from "@needle-di/core";
import { type WebSocket, WebSocketServer } from "ws";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger/logger.port.ts";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import {
  CLOSE_GRACE_MS,
  HTTP_EVENT,
  LISTEN_HOST,
  LISTENER_LOG,
  LISTENER_TEXT,
} from "@/server/adapters/bridge/bridge-listener/bridge-listener.constants.ts";
import { PLUGIN_CONNECTIONS } from "@/server/adapters/bridge/plugin-connections/plugin-connections.tokens.ts";
import { UPGRADE_ROLE } from "@/server/adapters/bridge/upgrade-guard/upgrade-guard.constants.ts";
import { UPGRADE_GUARD } from "@/server/adapters/bridge/upgrade-guard/upgrade-guard.tokens.ts";
import type { UpgradeRole, UpgradeVerdict } from "@/server/adapters/bridge/upgrade-guard/upgrade-guard.types.ts";
import { HEARTBEAT_MS } from "@/server/adapters/bridge/ws-socket/ws-socket.constants.ts";
import { WsSocket } from "@/server/adapters/bridge/ws-socket/ws-socket.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

/**
 * The owner's port (S-001): WebSocket upgrades on 127.0.0.1 only, each decided by the upgrade guard; plain HTTP gets
 * 426. A plugin's window the guard lets in goes to the handshake; one it refuses is told to the plugin connections for
 * the status hint. Closing frees the port first, then says goodbye (S-013).
 */
@injectable()
export class BridgeListener {
  readonly #settings;
  readonly #guard;
  readonly #logger;
  readonly #connections;
  #http: Server | undefined;
  #sockets: WebSocketServer | undefined;
  #port: number | null = null;

  constructor(
    settings = inject(BRIDGE_SETTINGS),
    guard = inject(UPGRADE_GUARD),
    logger = inject(LOGGER),
    connections = inject(PLUGIN_CONNECTIONS),
  ) {
    this.#settings = settings;
    this.#guard = guard;
    this.#logger = logger;
    this.#connections = connections;
  }

  /** The port it listens on; the one it will try before listen(). */
  port(): number {
    return this.#port ?? this.#settings.port;
  }

  /** Takes the port; throws what the system said when it cannot (EADDRINUSE: another program holds it). */
  async listen(): Promise<number> {
    const http = createServer((_request, response) => {
      response.writeHead(426, { [LISTENER_TEXT.contentType]: LISTENER_TEXT.plainText });
      response.end(STATUS_CODES[426]);
    });

    // One frame is at most 4 MiB, compressed never (S-006): an unpaired socket cannot push more.
    this.#sockets = new WebSocketServer({
      noServer: true,
      maxPayload: LIMITS.frameBytes,
      perMessageDeflate: false,
    });
    http.on(HTTP_EVENT.upgrade, (request, socket, head) => this.#upgrade(request, socket, head));
    await new Promise<void>((resolve, reject) => {
      http.once(HTTP_EVENT.error, reject);
      http.listen(this.#settings.port, LISTEN_HOST, () => {
        http.off(HTTP_EVENT.error, reject);
        resolve();
      });
    });

    const address = http.address();

    this.#http = http;
    this.#port = typeof address === "object" && address !== null ? address.port : this.#settings.port;
    this.#logger.info(LISTENER_LOG.listening, {
      component: LOG_COMPONENT.bridge,
      url: LISTENER_TEXT.url(this.#port),
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
      socket.close(CLOSE_CODE.goingAway, LISTENER_TEXT.goingAway);
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
    socket.on(HTTP_EVENT.error, () => socket.destroy());

    const verdict = this.#guard.check(request, this.port());

    if (verdict.status !== 101) {
      this.#refuse(request, socket, verdict);

      return;
    }

    this.#sockets?.handleUpgrade(request, socket, head, (webSocket) => this.#accept(webSocket, verdict.role));
  }

  /** A plain HTTP error and the socket closed; logged with the reason, the Origin and the Host, never all headers. */
  #refuse(
    request: IncomingMessage,
    socket: Duplex,
    verdict: Exclude<UpgradeVerdict, { status: 101 }>,
  ): void {
    const body = STATUS_CODES[verdict.status] ?? LISTENER_TEXT.unknownStatus;
    const refused = verdict.status === 403 ? verdict : null;

    this.#logger.warn(LISTENER_LOG.refused, {
      component: LOG_COMPONENT.bridge,
      status: verdict.status,
      role: refused?.role ?? null,
      reason: refused?.rejection.reason ?? LISTENER_TEXT.pathReason,
      origin: request.headers.origin ?? null,
      host: request.headers.host ?? null,
    });

    // Only a refused plugin tells something about the setup (the status hint); a refused peer or path does not.
    if (refused?.role === UPGRADE_ROLE.plugin) {
      this.#connections.rejected(refused.rejection);
    }

    socket.once(HTTP_EVENT.finish, () => socket.destroy());
    socket.end(LISTENER_TEXT.refusal(verdict.status, body));
  }

  /** A plugin's window starts its handshake, with the heartbeat watching its socket (S-007). */
  #accept(
    socket: WebSocket,
    role: UpgradeRole,
  ): void {
    if (role === UPGRADE_ROLE.peer) {
      socket.close(CLOSE_CODE.internalError, LISTENER_TEXT.noPeerHandshake);

      return;
    }

    const plugin = new WsSocket(socket, this.#logger);

    plugin.watch(HEARTBEAT_MS);
    this.#connections.open(plugin);
  }
}
