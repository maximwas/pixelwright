import { randomUUID } from "node:crypto";
import {
  BRIDGE_PROTOCOL_VERSION,
  CloseCode,
  decodePluginToServer,
  encode,
  PLUGIN_INFO_EVENT,
  PluginInfoSchema,
  type PluginToServer,
  type ServerToPlugin,
} from "@pixelwright/core";
import type { RawData, WebSocket } from "ws";
import { HELLO_TIMEOUT_MS } from "../constants/bridge.ts";
import type { BridgeLog, PluginConnectionOptions, PluginSession } from "../types/bridge.ts";
import { PendingRequests } from "./pending-requests.ts";

/** Sends one protocol message. A failed send is only logged: the socket's close handler cleans up. */
export function sendMessage(socket: WebSocket, message: ServerToPlugin, log: BridgeLog): void {
  socket.send(encode(message), (error) => {
    if (error) {
      log("send failed", { error: String(error) });
    }
  });
}

/** One plugin WebSocket: the hello handshake and its deadline, responses, info events, and liveness for the heartbeat. */
export class PluginConnection {
  readonly #socket: WebSocket;
  readonly #options: PluginConnectionOptions;
  readonly #helloTimer: ReturnType<typeof setTimeout>;
  #alive = true;
  #session: PluginSession | null = null;

  constructor(socket: WebSocket, options: PluginConnectionOptions) {
    this.#socket = socket;
    this.#options = options;
    this.#helloTimer = setTimeout(() => socket.close(CloseCode.HelloTimeout, "hello timeout"), HELLO_TIMEOUT_MS);
    socket.on("pong", () => {
      this.#alive = true;
    });
    socket.on("error", (error) => options.log("socket error", { error: String(error) }));
    socket.on("message", (data: RawData, isBinary: boolean) => {
      this.#onMessage(isBinary ? null : decodePluginToServer(data.toString()));
    });
    socket.on("close", (code) => this.#onClose(code));
  }

  /** A heartbeat tick. A plugin that did not answer the last ping is dead (frozen window, sleep, half-open). */
  checkAlive(): void {
    if (!this.#alive) {
      this.#socket.terminate();

      return;
    }

    this.#alive = false;
    this.#socket.ping();
  }

  #onMessage(message: PluginToServer | null): void {
    this.#alive = true;
    clearTimeout(this.#helloTimer);

    if (message === null) {
      this.#socket.close(CloseCode.BadMessage, "invalid message");
    } else if (this.#session === null) {
      this.#onHello(message);
    } else if (message.type === "response") {
      this.#session.pending.settle(message);
    } else if (message.type === "event") {
      this.#onEvent(this.#session, message.name, message.data);
    } else {
      this.#socket.close(CloseCode.BadMessage, "duplicate hello");
    }
  }

  #onHello(message: PluginToServer): void {
    if (message.type !== "hello") {
      this.#socket.close(CloseCode.BadMessage, "expected hello");

      return;
    }

    if (message.protocol !== BRIDGE_PROTOCOL_VERSION) {
      this.#socket.close(CloseCode.VersionMismatch, `protocol ${BRIDGE_PROTOCOL_VERSION} required`);

      return;
    }

    const connected = this.#options.next();
    const session: PluginSession = {
      id: randomUUID(),
      socket: this.#socket,
      pending: new PendingRequests(),
      connected,
      info: message.plugin,
      lastVisible: message.plugin.visible ? connected : 0,
    };

    this.#session = session;
    sendMessage(
      this.#socket,
      {
        type: "hello_ack",
        protocol: BRIDGE_PROTOCOL_VERSION,
        sessionId: session.id,
        server: {
          name: "pixelwright",
          version: this.#options.serverVersion,
        },
      },
      this.#options.log,
    );
    this.#options.onSession(session);
  }

  /** plugin.info: the plugin's file, page, window or Allow edits changed. Other events are ignored. */
  #onEvent(session: PluginSession, name: string, data: unknown): void {
    if (name !== PLUGIN_INFO_EVENT) {
      return;
    }

    const info = PluginInfoSchema.safeParse(data);

    if (!info.success) {
      return;
    }

    session.info = info.data;

    if (info.data.visible) {
      session.lastVisible = this.#options.next();
    }

    this.#options.onInfo(session);
  }

  #onClose(code: number): void {
    clearTimeout(this.#helloTimer);

    if (this.#session === null) {
      return;
    }

    this.#session.pending.failAll(code);
    this.#options.onSessionClosed(this.#session, code);
  }
}
