import { randomUUID } from "node:crypto";
import {
  BRIDGE_PROTOCOL_VERSION,
  CloseCode,
  decodePluginToServer,
  encode,
  newNonce,
  type PairingReason,
  PLUGIN_INFO_EVENT,
  type PluginInfo,
  PluginInfoSchema,
  type PluginKey,
  type PluginToServer,
  proofEquals,
  proofFor,
  type ServerToPlugin,
} from "@pixelwright/core";
import type { RawData, WebSocket } from "ws";
import { HELLO_TIMEOUT_MS, PAIRING_ATTEMPTS } from "../constants/bridge.ts";
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

/** Where a connection stands: waiting for hello, for the answer to its challenge, for the pairing code, or in. */
type Stage =
  | { readonly kind: "hello" }
  | {
      readonly kind: "challenged";
      readonly info: PluginInfo;
      readonly key: PluginKey;
      readonly pluginNonce: string;
      readonly serverNonce: string;
    }
  | { readonly kind: "pairing"; readonly info: PluginInfo }
  | { readonly kind: "session"; readonly session: PluginSession };

/**
 * One plugin WebSocket. A plugin with a key the server knows is challenged: the server proves the key first, then the
 * plugin must prove it back. A plugin without one waits for the user to type the pairing code into its window. Only
 * then is it a session: listed, asked, heard. Also liveness for the heartbeat.
 */
export class PluginConnection {
  readonly #socket: WebSocket;
  readonly #options: PluginConnectionOptions;
  #deadline: ReturnType<typeof setTimeout>;
  #alive = true;
  #stage: Stage = { kind: "hello" };

  constructor(socket: WebSocket, options: PluginConnectionOptions) {
    this.#socket = socket;
    this.#options = options;
    this.#deadline = setTimeout(() => socket.close(CloseCode.HelloTimeout, "hello timeout"), HELLO_TIMEOUT_MS);
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

    if (message === null) {
      this.#socket.close(CloseCode.BadMessage, "invalid message");

      return;
    }

    const stage = this.#stage;

    switch (stage.kind) {
      case "hello":
        clearTimeout(this.#deadline);
        this.#onHello(message);
        break;
      case "challenged":
        clearTimeout(this.#deadline);
        this.#onAuth(stage, message);
        break;
      case "pairing":
        this.#onPair(stage, message);
        break;
      case "session":
        this.#onSessionMessage(stage.session, message);
        break;
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

    const key = message.keyId === null ? null : this.#findKey(message.keyId);

    if (key !== null) {
      const serverNonce = newNonce();

      this.#stage = {
        kind: "challenged",
        info: message.plugin,
        key,
        pluginNonce: message.nonce,
        serverNonce,
      };
      this.#deadline = setTimeout(() => this.#socket.close(CloseCode.HelloTimeout, "auth timeout"), HELLO_TIMEOUT_MS);
      this.#send({
        type: "challenge",
        nonce: serverNonce,
        proof: proofFor(key.secret, "server", message.nonce, serverNonce),
      });

      return;
    }

    if (!this.#options.onPending(this)) {
      this.#socket.close(CloseCode.TooManySessions, "too many plugins waiting to be paired");

      return;
    }

    this.#stage = {
      kind: "pairing",
      info: message.plugin,
    };
    // Waiting lasts as long as a code does: a page cannot sit on the few waiting slots, and the real plugin reconnects.
    this.#deadline = setTimeout(
      () => this.#socket.close(CloseCode.HelloTimeout, "waited too long for the pairing code"),
      this.#options.pendingTimeoutMs,
    );
    this.#askToPair(message.keyId === null ? "no_key" : "unknown_key");
  }

  #onAuth(stage: Extract<Stage, { kind: "challenged" }>, message: PluginToServer): void {
    const expected = proofFor(stage.key.secret, "plugin", stage.serverNonce, stage.pluginNonce);

    if (message.type !== "auth" || !proofEquals(message.proof, expected)) {
      this.#socket.close(CloseCode.Unauthorized, "the plugin could not prove its key");

      return;
    }

    this.#admit(stage.info);
  }

  #onPair(stage: Extract<Stage, { kind: "pairing" }>, message: PluginToServer): void {
    if (message.type !== "pair") {
      this.#socket.close(CloseCode.BadMessage, "expected the pairing code");

      return;
    }

    const check = this.#options.checkCode(message.code);

    switch (check.outcome) {
      case "ok": {
        const key = this.#storeKey();

        if (key === null) {
          this.#socket.close(CloseCode.InternalError, "the key could not be stored");

          return;
        }

        clearTimeout(this.#deadline);
        this.#options.onPendingEnded(this);
        this.#send({
          type: "paired",
          key,
        });
        this.#admit(stage.info);
        break;
      }
      case "wrong":
        this.#send({
          type: "pairing_required",
          reason: "wrong_code",
          attemptsLeft: check.attemptsLeft,
          expiresInMs: this.#expiresInMs(),
        });
        break;
      case "expired":
        this.#askToPair("expired");
        break;
      case "locked":
        this.#askToPair("locked");
        break;
    }
  }

  /** A stored key; a key store that fails counts as one without the key (the plugin is asked to pair). */
  #findKey(id: string): PluginKey | null {
    try {
      return this.#options.keys.find(id);
    } catch (error) {
      this.#options.log("key lookup failed", { error: String(error) });

      return null;
    }
  }

  #storeKey(): PluginKey | null {
    try {
      return this.#options.keys.add();
    } catch (error) {
      this.#options.log("key store failed", { error: String(error) });

      return null;
    }
  }

  #onSessionMessage(session: PluginSession, message: PluginToServer): void {
    if (message.type === "response") {
      session.pending.settle(message);
    } else if (message.type === "event") {
      this.#onEvent(session, message.name, message.data);
    } else {
      this.#socket.close(CloseCode.BadMessage, `unexpected ${message.type}`);
    }
  }

  /** Tells the plugin to show the code field, with the code in force (status shows the code itself). */
  /**
   * Tells the plugin to show the code field. Never makes a code (only status does, so a guesser cannot mint fresh
   * ones); while pairing is locked, says so with the time left.
   */
  #askToPair(reason: PairingReason): void {
    const lockedUntil = this.#options.lockedUntil();
    const now = this.#options.now();

    if (lockedUntil !== null) {
      this.#send({
        type: "pairing_required",
        reason: "locked",
        attemptsLeft: 0,
        expiresInMs: Math.max(0, lockedUntil - now),
      });

      return;
    }

    const active = this.#options.activeCode();

    this.#send({
      type: "pairing_required",
      reason,
      attemptsLeft: active?.attemptsLeft ?? PAIRING_ATTEMPTS,
      expiresInMs: active === null ? 0 : Math.max(0, active.expiresAt - now),
    });
  }

  #expiresInMs(): number {
    const active = this.#options.activeCode();

    return active === null ? 0 : Math.max(0, active.expiresAt - this.#options.now());
  }

  /** The plugin proved its key or typed the code: it becomes a session unless the server is full. */
  #admit(info: PluginInfo): void {
    if (!this.#options.admit(info)) {
      this.#socket.close(CloseCode.TooManySessions, "too many plugin sessions");

      return;
    }

    const connected = this.#options.next();
    const session: PluginSession = {
      id: randomUUID(),
      socket: this.#socket,
      pending: new PendingRequests(),
      connected,
      info,
      lastVisible: info.visible ? connected : 0,
    };

    this.#stage = {
      kind: "session",
      session,
    };
    this.#send({
      type: "hello_ack",
      protocol: BRIDGE_PROTOCOL_VERSION,
      sessionId: session.id,
      server: {
        name: "pixelwright",
        version: this.#options.serverVersion,
      },
    });
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

  #send(message: ServerToPlugin): void {
    sendMessage(this.#socket, message, this.#options.log);
  }

  #onClose(code: number): void {
    clearTimeout(this.#deadline);

    const stage = this.#stage;

    if (stage.kind === "pairing") {
      this.#options.onPendingEnded(this);
    } else if (stage.kind === "session") {
      stage.session.pending.failAll(code);
      this.#options.onSessionClosed(stage.session, code);
    }
  }
}
