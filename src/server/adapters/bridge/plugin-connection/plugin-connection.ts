import { randomBytes } from "node:crypto";
import * as zod from "zod/mini";
import { CHANNEL } from "../../../../shared/protocol/channel.constants.ts";
import {
  type Hello,
  HelloProtocolSchema,
  type PairingReason,
  type PluginHandshake,
  PluginHandshakeSchema,
  type ServerHandshake,
} from "../../../../shared/protocol/handshake.schema.ts";
import type { MessageSocket } from "../../../../shared/protocol/message-socket.types.ts";
import type { PluginInfo } from "../../../../shared/protocol/plugin-info.schema.ts";
import { Proof } from "../../../../shared/protocol/proof/proof.ts";
import { CLOSE_CODE, NONCE_BYTES, PROTOCOL } from "../../../../shared/protocol/protocol.constants.ts";
import { ProtocolReason } from "../../../../shared/protocol/protocol-reason/protocol-reason.ts";
import { VERSION } from "../../../../shared/version/version.constants.ts";
import type { PluginKey } from "../bridge-config/bridge-config.types.ts";
import { PAIRING_CODE_TTL_MS } from "../pairing-codes/pairing-codes.constants.ts";
import { BridgeSession } from "../sessions/bridge-session/bridge-session.ts";
import { EXPECTED_FRAMES, HELLO_TIMEOUT_MS, NOT_PAIRED_REASONS } from "./plugin-connection.constants.ts";
import type { ConnectionState, HandshakeServices } from "./plugin-connection.types.ts";

type Waiting = Exclude<ConnectionState, { readonly name: "session" | "closed" }>;

type Challenged = Extract<ConnectionState, { readonly name: "challenged" }>;

type Pairing = Extract<ConnectionState, { readonly name: "pairing" }>;

/**
 * One plugin socket through the handshake (A§5.2), a State machine: one state field, and EXPECTED_FRAMES as its
 * transition table. A plugin of another protocol is turned away at hello. One whose key the server knows is challenged:
 * the server proves the key first, the plugin proves it back within 5 s. One without waits, at most a code's lifetime,
 * for the user to type the code status shows. Only then is it a session: listed, and later asked. When the server
 * closes the socket itself, the state ends at once: ws reports the close only when the other side answers, up to 30 s
 * for a dead one (P1).
 */
export class PluginConnection {
  readonly #socket: MessageSocket;
  readonly #services: HandshakeServices;
  #state: ConnectionState = { name: "hello" };
  #deadline: ReturnType<typeof setTimeout> | undefined;

  constructor(
    socket: MessageSocket,
    services: HandshakeServices,
  ) {
    this.#socket = socket;
    this.#services = services;
  }

  /** Listens, and gives the plugin HELLO_TIMEOUT_MS to say hello (S-008). */
  start(): void {
    this.#socket.onMessage((text) => this.#receive(text));
    this.#socket.onClose((code) => this.#leave(code));
    this.#expire(HELLO_TIMEOUT_MS, "hello timeout");
  }

  /** Closes it from this side: a refusal, a timeout, or a newer socket of the same window. */
  close(
    code: number,
    reason: string,
  ): void {
    if (this.#state.name === "closed") {
      return;
    }

    this.#services.logger.info("plugin connection closed by the server", {
      component: "bridge",
      state: this.#state.name,
      code,
      reason,
    });
    this.#leave(code);
    this.#socket.close(code, reason);
  }

  #receive(text: string | null): void {
    const state = this.#state;

    // shortcut: a session's frames are RPC, which item 05 attaches; until then they only keep the socket alive.
    if (state.name === "session" || state.name === "closed") {
      return;
    }

    const json = this.#json(text);

    if (state.name === "hello" && this.#refusesProtocol(json)) {
      return;
    }

    const frame = zod.safeParse(PluginHandshakeSchema, json);

    if (frame.success) {
      this.#take(state, frame.data);
    } else {
      this.close(CLOSE_CODE.badMessage, "invalid message");
    }
  }

  /** One transition: the frame the state expects moves it on; any other is turned away as the table says. */
  #take(
    state: Waiting,
    frame: PluginHandshake,
  ): void {
    if (state.name === "hello" && frame.type === "hello") {
      this.#hello(frame);
    } else if (state.name === "challenged" && frame.type === "auth") {
      this.#auth(state, frame.proof);
    } else if (state.name === "pairing" && frame.type === "pair") {
      this.#pair(state, frame.code);
    } else {
      this.close(EXPECTED_FRAMES[state.name].code, EXPECTED_FRAMES[state.name].reason);
    }
  }

  /** The one exact check (D-02, S-004): another protocol is closed 4426 naming this one, and kept for status. */
  #refusesProtocol(json: unknown): boolean {
    const hello = zod.safeParse(HelloProtocolSchema, json);

    if (!hello.success || hello.data.protocol === PROTOCOL) {
      return false;
    }

    const refusal = {
      protocol: hello.data.protocol,
      pluginVersion: hello.data.plugin?.pluginVersion ?? null,
    };

    this.#services.sessions.refused(refusal);
    this.#services.logger.warn("plugin of another protocol turned away", {
      component: "bridge",
      ...refusal,
      required: PROTOCOL,
    });
    this.close(CLOSE_CODE.versionMismatch, ProtocolReason.required(PROTOCOL).text());

    return true;
  }

  #hello(hello: Hello): void {
    clearTimeout(this.#deadline);

    const key = hello.keyId === null ? null : this.#services.keys.findKey(hello.keyId);

    if (key === null) {
      this.#awaitCode(hello.plugin, hello.keyId === null ? "no_key" : "unknown_key");
    } else {
      this.#challenge(hello, key);
    }
  }

  /** The server proves the key first, over the plugin's nonce and a fresh one of its own (S-023). */
  #challenge(
    hello: Hello,
    key: PluginKey,
  ): void {
    const serverNonce = randomBytes(NONCE_BYTES).toString("hex");

    this.#state = {
      name: "challenged",
      info: hello.plugin,
      key,
      pluginNonce: hello.nonce,
      serverNonce,
    };
    this.#expire(HELLO_TIMEOUT_MS, "auth timeout");
    this.#send({
      type: "challenge",
      nonce: serverNonce,
      proof: Proof.sign(key.secret, "server", hello.nonce, serverNonce).hex(),
    });
  }

  /** No key, or one bridge.json lacks: the window waits for the user's code, at most a code's lifetime (S-022). */
  #awaitCode(
    info: PluginInfo,
    reason: PairingReason,
  ): void {
    if (!this.#services.sessions.wait(this)) {
      this.close(CLOSE_CODE.tooManySessions, "too many plugins waiting to be paired");

      return;
    }

    this.#state = {
      name: "pairing",
      info,
    };
    this.#expire(PAIRING_CODE_TTL_MS, "waited too long for the pairing code");
    this.#send({
      type: "pairing_required",
      ...this.#services.pairing.prompt(reason),
    });
  }

  /** The plugin's proof, over the server's nonce and its own: right lets it in, anything else is 4401. */
  #auth(
    state: Challenged,
    proof: string,
  ): void {
    clearTimeout(this.#deadline);

    if (Proof.of(proof).equals(Proof.sign(state.key.secret, "plugin", state.serverNonce, state.pluginNonce))) {
      this.#admit(state.info);
    } else {
      this.close(EXPECTED_FRAMES.challenged.code, EXPECTED_FRAMES.challenged.reason);
    }
  }

  /** The code the user typed: the right one gives the window a key; any other tells it what is left (S-022). */
  #pair(
    state: Pairing,
    code: string,
  ): void {
    const check = this.#services.pairing.check(code);

    if (check.outcome !== "ok") {
      this.#send({
        type: "pairing_required",
        ...this.#services.pairing.prompt(NOT_PAIRED_REASONS[check.outcome]),
      });

      return;
    }

    const key = this.#storeKey();

    if (key === null) {
      this.close(CLOSE_CODE.internalError, "the key could not be stored");

      return;
    }

    clearTimeout(this.#deadline);
    this.#services.sessions.stopWaiting(this);
    this.#send({
      type: "paired",
      key,
    });
    this.#admit(state.info);
  }

  #storeKey(): PluginKey | null {
    try {
      return this.#services.keys.addKey();
    } catch (error) {
      this.#services.logger.error("the paired plugin's key could not be stored", {
        component: "bridge",
        err: error,
      });

      return null;
    }
  }

  /** The plugin proved its key or typed the code: a session, unless the bridge is full (S-010). */
  #admit(info: PluginInfo): void {
    const sessions = this.#services.sessions;

    if (!sessions.admits(info)) {
      this.close(CLOSE_CODE.tooManySessions, "too many plugin sessions");

      return;
    }

    const session = new BridgeSession(this, info, sessions.next());

    this.#state = {
      name: "session",
      session,
    };
    this.#send({
      type: "hello_ack",
      protocol: PROTOCOL,
      sessionId: session.id,
      server: {
        name: CHANNEL.name,
        version: VERSION,
      },
    });
    sessions.add(session);
  }

  /** The state ends: its timer stops, and its waiting slot or its session is freed now. */
  #leave(code: number): void {
    const state = this.#state;

    clearTimeout(this.#deadline);
    this.#state = { name: "closed" };

    if (state.name === "pairing") {
      this.#services.sessions.stopWaiting(this);
    } else if (state.name === "session") {
      this.#services.sessions.remove(state.session, code);
    }
  }

  /** The current state's deadline: when it passes, the socket is closed 4408 and the plugin reconnects afresh. */
  #expire(
    ms: number,
    reason: string,
  ): void {
    clearTimeout(this.#deadline);
    this.#deadline = setTimeout(() => this.close(CLOSE_CODE.helloTimeout, reason), ms);
  }

  #send(frame: ServerHandshake): void {
    this.#socket.send(JSON.stringify(frame));
  }

  /** The frame as JSON, or undefined (which JSON never is) when it is not JSON or not text. */
  #json(text: string | null): unknown {
    if (text === null) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
}
