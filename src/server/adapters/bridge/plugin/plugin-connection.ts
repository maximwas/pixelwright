import { randomBytes } from "node:crypto";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as zod from "zod/mini";
import { LOG_COMPONENT } from "@/core/ports/logger.constants.ts";
import type { PluginKey } from "@/server/adapters/bridge/listener/bridge-config.ts";
import {
  CLOSE_REASON,
  CODE_CHECK,
  CONNECTION_LOG,
  CONNECTION_STATE,
  EXPECTED_FRAMES,
  HELLO_TIMEOUT_MS,
  NOT_PAIRED_REASONS,
  PAIRING_CODE_TTL_MS,
} from "@/server/adapters/bridge/plugin/plugin.constants.ts";
import type { ConnectionState, HandshakeServices } from "@/server/adapters/bridge/plugin/plugin.types.ts";
import { BridgeSession } from "@/server/adapters/bridge/sessions/bridge-session.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { HANDSHAKE_TYPE, PAIRING_REASON } from "@/shared/protocol/handshake.constants.ts";
import {
  type Hello,
  HelloProtocolSchema,
  type PairingReason,
  type PluginHandshake,
  PluginHandshakeSchema,
  type ServerHandshake,
} from "@/shared/protocol/handshake.schema.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import { Proof } from "@/shared/protocol/proof.ts";
import { CLOSE_CODE, NONCE_BYTES, PROOF_ROLE, PROTOCOL } from "@/shared/protocol/protocol.constants.ts";
import { ProtocolReason } from "@/shared/protocol/protocol-reason.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

type Waiting = Exclude<
  ConnectionState,
  { readonly name: typeof CONNECTION_STATE.session | typeof CONNECTION_STATE.closed }
>;

type Challenged = Extract<ConnectionState, { readonly name: typeof CONNECTION_STATE.challenged }>;

type Pairing = Extract<ConnectionState, { readonly name: typeof CONNECTION_STATE.pairing }>;

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
  #state: ConnectionState = { name: CONNECTION_STATE.hello };
  #deadline: ReturnType<typeof setTimeout> | undefined;

  constructor(socket: MessageSocket, services: HandshakeServices) {
    this.#socket = socket;
    this.#services = services;
  }

  /** Listens, and gives the plugin HELLO_TIMEOUT_MS to say hello (S-008). */
  start(): void {
    this.#socket.onMessage((text) => this.#receive(text));
    this.#socket.onClose((code) => this.#leave(code));
    this.#expire(HELLO_TIMEOUT_MS, CLOSE_REASON.helloTimeout);
  }

  /** Closes it from this side: a refusal, a timeout, or a newer socket of the same window. */
  close(code: number, reason: string): void {
    if (this.#state.name === CONNECTION_STATE.closed) {
      return;
    }

    this.#services.logger.info(CONNECTION_LOG.closed, {
      component: LOG_COMPONENT.bridge,
      state: this.#state.name,
      code,
      reason,
    });
    this.#leave(code);
    this.#socket.close(code, reason);
  }

  /** One RPC frame to the plugin, once it is a session. */
  send(text: string): void {
    this.#socket.send(text);
  }

  #receive(text: string | null): void {
    const state = this.#state;

    // A session's frames are RPC (A§5.4); the protocol never sends a binary frame.
    if (state.name === CONNECTION_STATE.session) {
      if (text !== null && !this.#services.sessions.dismissal(text)) {
        state.session.rpc.receive(text);
      }

      return;
    }

    if (state.name === CONNECTION_STATE.closed) {
      return;
    }

    const json = this.#json(text);

    if (state.name === CONNECTION_STATE.hello && this.#refusesProtocol(json)) {
      return;
    }

    const frame = zod.safeParse(PluginHandshakeSchema, json);

    if (frame.success) {
      this.#take(state, frame.data);
    } else {
      this.close(CLOSE_CODE.badMessage, CLOSE_REASON.invalidMessage);
    }
  }

  /** One transition: the frame the state expects moves it on; any other is turned away as the table says. */
  #take(state: Waiting, frame: PluginHandshake): void {
    if (state.name === CONNECTION_STATE.hello && frame.type === HANDSHAKE_TYPE.hello) {
      this.#hello(frame);
    } else if (state.name === CONNECTION_STATE.challenged && frame.type === HANDSHAKE_TYPE.auth) {
      this.#auth(state, frame.proof);
    } else if (state.name === CONNECTION_STATE.pairing && frame.type === HANDSHAKE_TYPE.pair) {
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

    const refusal = { protocol: hello.data.protocol, pluginVersion: hello.data.plugin?.pluginVersion ?? null };

    this.#services.sessions.refused(refusal);
    this.#services.logger.warn(CONNECTION_LOG.otherProtocol, {
      component: LOG_COMPONENT.bridge,
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
      this.#awaitCode(hello.plugin, hello.keyId === null ? PAIRING_REASON.noKey : PAIRING_REASON.unknownKey);
    } else {
      this.#challenge(hello, key);
    }
  }

  /** The server proves the key first, over the plugin's nonce and a fresh one of its own (S-023). */
  #challenge(hello: Hello, key: PluginKey): void {
    const serverNonce = bytesToHex(randomBytes(NONCE_BYTES));

    this.#state = { name: CONNECTION_STATE.challenged, info: hello.plugin, key, pluginNonce: hello.nonce, serverNonce };
    this.#expire(HELLO_TIMEOUT_MS, CLOSE_REASON.authTimeout);
    this.#send({
      type: HANDSHAKE_TYPE.challenge,
      nonce: serverNonce,
      proof: Proof.sign(key.secret, PROOF_ROLE.server, hello.nonce, serverNonce).hex(),
    });
  }

  /** No key, or one bridge.json lacks: the window waits for the user's code, at most a code's lifetime (S-022). */
  #awaitCode(info: PluginInfo, reason: PairingReason): void {
    if (!this.#services.sessions.wait(this)) {
      this.close(CLOSE_CODE.tooManySessions, CLOSE_REASON.tooManyWaiting);

      return;
    }

    this.#state = { name: CONNECTION_STATE.pairing, info };
    this.#expire(PAIRING_CODE_TTL_MS, CLOSE_REASON.codeTimeout);
    this.#promptPairing(reason);
  }

  /** The plugin's proof, over the server's nonce and its own: right lets it in, anything else is 4401. */
  #auth(state: Challenged, proof: string): void {
    clearTimeout(this.#deadline);

    const expected = Proof.sign(state.key.secret, PROOF_ROLE.plugin, state.serverNonce, state.pluginNonce);

    if (Proof.of(proof).equals(expected)) {
      this.#admit(state.info);
    } else {
      this.close(CLOSE_CODE.unauthorized, CLOSE_REASON.unproven);
    }
  }

  /** The code the user typed: the right one gives the window a key; any other tells it what is left (S-022). */
  #pair(state: Pairing, code: string): void {
    const check = this.#services.pairing.check(code);

    if (check.outcome !== CODE_CHECK.ok) {
      this.#promptPairing(NOT_PAIRED_REASONS[check.outcome]);

      return;
    }

    const key = this.#storeKey();

    if (key === null) {
      this.close(CLOSE_CODE.internalError, CLOSE_REASON.keyNotStored);

      return;
    }

    clearTimeout(this.#deadline);
    this.#services.sessions.stopWaiting(this);
    this.#send({ type: HANDSHAKE_TYPE.paired, key });
    this.#admit(state.info);
  }

  #storeKey(): PluginKey | null {
    try {
      return this.#services.keys.addKey();
    } catch (error) {
      this.#services.logger.error(CONNECTION_LOG.keyNotStored, { component: LOG_COMPONENT.bridge, err: error });

      return null;
    }
  }

  /** The plugin proved its key or typed the code: a session, unless the bridge is full (S-010). */
  #admit(info: PluginInfo): void {
    const sessions = this.#services.sessions;

    if (!sessions.admits(info)) {
      this.close(CLOSE_CODE.tooManySessions, CLOSE_REASON.tooManySessions);

      return;
    }

    const session = new BridgeSession(this, info, sessions);

    this.#state = { name: CONNECTION_STATE.session, session };
    this.#send({
      type: HANDSHAKE_TYPE.helloAck,
      protocol: PROTOCOL,
      sessionId: session.id,
      server: { name: CHANNEL.name, version: VERSION },
    });
    sessions.add(session);
  }

  /** The state ends: its timer stops, and its waiting slot or its session is freed now. */
  #leave(code: number): void {
    const state = this.#state;

    clearTimeout(this.#deadline);
    this.#state = { name: CONNECTION_STATE.closed };

    if (state.name === CONNECTION_STATE.pairing) {
      this.#services.sessions.stopWaiting(this);
    } else if (state.name === CONNECTION_STATE.session) {
      state.session.rpc.close();
      this.#services.sessions.remove(state.session, code);
    }
  }

  /** The current state's deadline: when it passes, the socket is closed 4408 and the plugin reconnects afresh. */
  #expire(ms: number, reason: string): void {
    clearTimeout(this.#deadline);
    this.#deadline = setTimeout(() => this.close(CLOSE_CODE.helloTimeout, reason), ms);
  }

  /** Asks the window for the code: why, and the tries left (S-022). */
  #promptPairing(reason: PairingReason): void {
    this.#send({ type: HANDSHAKE_TYPE.pairingRequired, ...this.#services.pairing.prompt(reason) });
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
