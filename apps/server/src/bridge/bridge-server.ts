// The plugin bridge on 127.0.0.1: one socket per open Figma file whose Pixelwright plugin runs, and the peer socket of
// other pixelwright processes. Never log to stdout: it is the MCP stdio channel.
import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";
import { BridgeError, CloseCode, MAX_MESSAGE_BYTES } from "@pixelwright/core";
import { type WebSocket, WebSocketServer } from "ws";
import {
  CLOSE_GRACE_MS,
  HEARTBEAT_MS,
  MAX_PENDING_PLUGINS,
  MAX_PLUGIN_SESSIONS,
  REQUEST_TIMEOUT_MS,
} from "../constants/bridge.ts";
import type {
  BridgeLog,
  BridgeServerOptions,
  ConnectedPlugin,
  PairingCodesLike,
  PairingStatus,
  PluginLink,
  PluginSession,
  RequestOptions,
  UpgradePolicy,
  UpgradeRejection,
} from "../types/bridge.ts";
import { pickActive } from "../utils/active-session.ts";
import { closeGracefully, listenOnLoopback } from "./http-lifecycle.ts";
import { PairingCodes } from "./pairing-codes.ts";
import { PeerConnection } from "./peer-connection.ts";
import { PluginConnection, sendMessage } from "./plugin-connection.ts";
import { checkUpgrade, rejectUpgrade } from "./upgrade-guard.ts";

const notConnected = () =>
  new BridgeError(
    "PLUGIN_NOT_CONNECTED",
    "No Figma file is connected: run the Pixelwright plugin in Figma Desktop and keep its window open.",
  );

/**
 * The bridge's owner: plugin sessions (one per open file, the last hello of a plugin window wins over its older
 * socket), the active one for requests that name no session, and the heartbeat that drops dead sockets.
 */
export class BridgeServer
  extends EventEmitter<{
    changed: [];
    rejected: [UpgradeRejection];
  }>
  implements PluginLink
{
  readonly #options: BridgeServerOptions;
  readonly #http: Server;
  readonly #sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
  });
  readonly #connections = new WeakMap<WebSocket, PluginConnection>();
  readonly #sessions = new Map<string, PluginSession>();
  readonly #peers = new Set<PeerConnection>();
  /** Unpaired plugins waiting for the user to type the code: never listed, never asked. */
  readonly #pending = new Set<unknown>();
  readonly #pairing: PairingCodesLike;
  /** What peers last heard about pairing, and the timer that tells them when the code or the pause runs out. */
  #pairingSnapshot = "";
  #pairingTimer: ReturnType<typeof setTimeout> | undefined;
  #policy: UpgradePolicy;
  #sequence = 0;
  #requests = 0;
  #heartbeat: ReturnType<typeof setInterval> | undefined;
  #port: number | null = null;

  constructor(options: BridgeServerOptions) {
    super();
    this.#options = options;
    this.#pairing = options.pairing ?? new PairingCodes();
    // No Host passes until listen() knows the port.
    this.#policy = {
      allowedHosts: new Set(),
      pluginOrigins: new Set(options.pluginOrigins),
    };
    // Plain HTTP has nothing to serve: the port is for WebSocket upgrades only.
    this.#http = createServer((_request, response) => {
      response.writeHead(426, { "content-type": "text/plain" });
      response.end("Upgrade Required");
    });
    this.#http.on("upgrade", this.#onUpgrade);
  }

  /** The port this server listens on, or null before listen() or while another process holds it. */
  get port(): number | null {
    return this.#port;
  }

  /** Listens on 127.0.0.1. Resolves with the port, or null while another process holds it. */
  async listen(): Promise<number | null> {
    const port = await listenOnLoopback(this.#http, this.#options.port);

    if (port === null) {
      return null;
    }

    this.#port = port;
    this.#policy = {
      ...this.#policy,
      allowedHosts: new Set([`127.0.0.1:${port}`, `localhost:${port}`]),
    };
    this.#heartbeat = setInterval(() => this.#checkClients(), HEARTBEAT_MS);
    this.#heartbeat.unref();

    return port;
  }

  /** Frees the port first, so a new server process can take it at once, then says goodbye to the plugins. */
  async close(): Promise<void> {
    clearInterval(this.#heartbeat);
    clearTimeout(this.#pairingTimer);
    await closeGracefully(this.#http, this.#sockets, CLOSE_GRACE_MS);
  }

  plugins(): ConnectedPlugin[] {
    const active = pickActive(this.#sessions.values());

    return [...this.#sessions.values()].map((session) => ({
      session: session.id,
      info: session.info,
      active: session === active,
    }));
  }

  /**
   * For status: the code to show while an unpaired plugin waits, made here and only here (asking for status is what
   * makes a code), or the end of the pause after too many wrong codes; null while none waits.
   */
  pairing(): PairingStatus | null {
    if (this.#pending.size === 0) {
      clearTimeout(this.#pairingTimer);

      return null;
    }

    const active = this.#pairing.ensure();
    const status: PairingStatus = {
      code: active?.code ?? null,
      expiresAt: active?.expiresAt ?? null,
      lockedUntil: this.#pairing.lockedUntil(),
      waiting: this.#pending.size,
    };

    this.#watchPairing(status);

    return status;
  }

  /**
   * Peers show the code the owner makes: they hear it whenever it changes, and when it or the pause runs out (a code
   * expires silently, so a timer fires then and the next status makes a fresh one).
   */
  #watchPairing(status: PairingStatus): void {
    const snapshot = JSON.stringify(status);

    if (snapshot !== this.#pairingSnapshot) {
      this.#pairingSnapshot = snapshot;
      queueMicrotask(() => this.#tellPeers());
    }

    clearTimeout(this.#pairingTimer);

    const next = Math.min(status.expiresAt ?? Number.POSITIVE_INFINITY, status.lockedUntil ?? Number.POSITIVE_INFINITY);

    if (Number.isFinite(next)) {
      this.#pairingTimer = setTimeout(() => this.#tellPeers(), Math.max(0, next - this.#pairing.now()) + 10);
      this.#pairingTimer.unref();
    }
  }

  #tellPeers(): void {
    for (const peer of this.#peers) {
      peer.sendStatus();
    }
  }

  /** Sends an operation to a plugin (the active one unless a session is named) and resolves with its result. */
  request(op: string, input: unknown, { session }: RequestOptions = {}): Promise<unknown> {
    const target = session === undefined ? pickActive(this.#sessions.values()) : (this.#sessions.get(session) ?? null);

    if (target === null) {
      return Promise.reject(
        session === undefined
          ? notConnected()
          : new BridgeError("FILE_NOT_FOUND", `No connected file has session ${session}: call status for the files.`),
      );
    }

    if (target.socket.readyState !== target.socket.OPEN) {
      return Promise.reject(notConnected());
    }

    const id = String(++this.#requests);
    const timeoutMs = this.#options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    const answer = target.pending.track(id, op, timeoutMs);

    sendMessage(
      target.socket,
      {
        type: "request",
        id,
        op,
        input: input ?? null,
        timeoutMs,
      },
      this.#log,
    );

    return answer;
  }

  #onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const onSocketError = () => socket.destroy();

    socket.on("error", onSocketError);

    const verdict = checkUpgrade(request, this.#policy);
    // Never log request.headers wholesale.
    const { origin, host } = request.headers;
    const reason = verdict.status === 403 ? verdict.rejection.reason : null;

    this.#log("upgrade", {
      origin,
      host,
      status: verdict.status,
      reason,
    });

    if (verdict.status !== 101) {
      rejectUpgrade(socket, verdict.status);

      // Only a refused plugin says something about the setup (see the bridge hints).
      if (verdict.status === 403 && verdict.role === "plugin") {
        this.emit("rejected", verdict.rejection);
      }

      return;
    }

    socket.removeListener("error", onSocketError);
    this.#sockets.handleUpgrade(request, socket, head, (webSocket) =>
      verdict.role === "plugin" ? this.#accept(webSocket) : this.#acceptPeer(webSocket),
    );
  };

  #accept(socket: WebSocket): void {
    const connection = new PluginConnection(socket, {
      serverVersion: this.#options.serverVersion,
      log: this.#log,
      next: () => ++this.#sequence,
      admit: (info) =>
        this.#sessions.size < MAX_PLUGIN_SESSIONS ||
        [...this.#sessions.values()].some((session) => session.info.instanceId === info.instanceId),
      keys: this.#options.keys,
      activeCode: () => this.#pairing.active(),
      lockedUntil: () => this.#pairing.lockedUntil(),
      checkCode: (code) => {
        const check = this.#pairing.check(code);

        // A used, spent or locked code changes what peers must show.
        queueMicrotask(() => this.#tellPeers());

        return check;
      },
      now: () => this.#pairing.now(),
      onPending: (waiting) => {
        if (this.#pending.size >= MAX_PENDING_PLUGINS) {
          return false;
        }

        this.#pending.add(waiting);
        this.#changed();

        return true;
      },
      onPendingEnded: (waiting) => {
        if (this.#pending.delete(waiting)) {
          this.#changed();
        }
      },
      onSession: (session) => this.#activate(session),
      onInfo: () => this.#changed(),
      onSessionClosed: (session, code) => this.#deactivate(session, code),
    });

    this.#connections.set(socket, connection);
  }

  /** Another pixelwright process joined: its operations go on to the plugins, and it hears when they change. */
  #acceptPeer(socket: WebSocket): void {
    const peer = new PeerConnection(socket, {
      log: this.#log,
      token: this.#options.token,
      pairing: () => this.pairing(),
      relay: (op, input, options) => this.request(op, input, options),
      plugins: () => this.plugins(),
      onClose: () => this.#peers.delete(peer),
    });

    this.#peers.add(peer);
    this.#log("peer joined", { peers: this.#peers.size });
  }

  /** A plugin said hello. The same window reconnecting (after sleep, say) replaces its half-open old socket. */
  #activate(session: PluginSession): void {
    for (const other of this.#sessions.values()) {
      if (other.info.instanceId === session.info.instanceId) {
        this.#sessions.delete(other.id);
        other.socket.close(CloseCode.Superseded, "superseded by a newer connection of the same plugin window");
      }
    }

    this.#sessions.set(session.id, session);
    this.#log("plugin connected", {
      file: session.info.file.name,
      sessions: this.#sessions.size,
    });
    this.#changed();
  }

  #deactivate(session: PluginSession, code: number): void {
    if (this.#sessions.get(session.id) !== session) {
      return;
    }

    this.#sessions.delete(session.id);
    this.#log("plugin disconnected", {
      file: session.info.file.name,
      code,
    });
    this.#changed();
  }

  #changed(): void {
    this.emit("changed");
    this.#tellPeers();
  }

  #checkClients(): void {
    for (const socket of this.#sockets.clients) {
      this.#connections.get(socket)?.checkAlive();
    }
  }

  #log: BridgeLog = (message, data) => {
    this.#options.log?.(message, data);
  };
}
