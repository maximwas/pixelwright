import { InjectionToken, inject, injectable } from "@needle-di/core";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import * as zod from "zod/mini";
import { BACKOFF } from "@/plugin-ui/link/backoff.ts";
import {
  CLOSE_ACTION,
  CLOSE_RULES,
  HANDSHAKE_STATE,
  LINK_CLOSE_REASON,
  LINK_STATE,
  TAKEN_IN,
} from "@/plugin-ui/link/link.constants.ts";
import { HANDSHAKE_TYPE } from "@/shared/protocol/handshake.constants.ts";
import {
  type PairingReason,
  type PluginHandshake,
  type PluginKey,
  type ServerHandshake,
  ServerHandshakeSchema,
} from "@/shared/protocol/handshake.schema.ts";
import type { MessageSocket } from "@/shared/protocol/message-socket.types.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import { Proof } from "@/shared/protocol/proof.ts";
import { CLOSE_CODE, NONCE_BYTES, PROOF_ROLE, PROTOCOL } from "@/shared/protocol/protocol.constants.ts";
import { ProtocolReason } from "@/shared/protocol/protocol-reason.ts";
import { LINK_OPENED_FRAME } from "@/shared/window/ui-message.constants.ts";

/**
 * The plugin's end of the bridge, in the window (A§4.4, A§5.2), a State machine: one handshake field and TAKEN_IN as
 * its transition table. It says hello, proves the stored key only once the server proved it first, or sends the code
 * the user typed and takes the key the server issues for it. A session's frames go to main unread. When a socket
 * closes, the close table says whether to wait and try again or stop; the key is never cleared on the way (S-025).
 * Each socket has an epoch: events of a socket that is gone are ignored, and so is a frame main sends for it (P1).
 */
@injectable()
export class SocketLink {
  readonly #sockets;
  readonly #backoff;
  #observer: LinkObserver | null = null;
  #key: PluginKey | null = null;
  #socket: MessageSocket | null = null;
  #epoch = 0;
  #handshake: Handshake = { name: HANDSHAKE_STATE.closed };

  constructor(sockets = inject(SOCKET_OPENER), backoff = inject(BACKOFF)) {
    this.#sockets = sockets;
    this.#backoff = backoff;
  }

  /** Connects with the key main stored (or none), and keeps connecting for as long as the window is open. */
  start(key: PluginKey | null, observer: LinkObserver): void {
    this.#key = key;
    this.#observer = observer;
    this.#open();
  }

  /** The code the user typed: it goes only while the server waits for one. */
  pair(code: string): void {
    if (this.#handshake.name === HANDSHAKE_STATE.pairing) {
      this.#handshake = { name: HANDSHAKE_STATE.pairSent };
      this.#send({ type: HANDSHAKE_TYPE.pair, code });
    }
  }

  /** A frame main sends for the session of `epoch`: dropped unread when that socket is gone (P1). */
  relay(epoch: number, text: string): void {
    if (epoch === this.#epoch && this.#handshake.name === HANDSHAKE_STATE.session) {
      this.#socket?.send(text);
    }
  }

  #open(): void {
    const observer = this.#observer;

    if (observer === null) {
      return;
    }

    const socket = this.#sockets.open();
    const epoch = this.#epoch + 1;
    const nonce = bytesToHex(randomBytes(NONCE_BYTES));

    this.#epoch = epoch;
    this.#socket = socket;
    this.#handshake = { name: HANDSHAKE_STATE.hello, nonce };
    observer.state({ kind: LINK_STATE.connecting });
    socket.onMessage((text) => epoch === this.#epoch && this.#receive(text));
    socket.onClose((code, reason) => epoch === this.#epoch && this.#closed(code, reason));
    this.#send({
      type: HANDSHAKE_TYPE.hello,
      protocol: PROTOCOL,
      plugin: observer.info(),
      keyId: this.#key?.id ?? null,
      nonce,
    });
  }

  #receive(text: string | null): void {
    if (this.#handshake.name === HANDSHAKE_STATE.session) {
      if (text !== null) {
        this.#observer?.frame(this.#epoch, text);
      }

      return;
    }

    const frame = zod.safeParse(ServerHandshakeSchema, this.#json(text));
    const takenIn: readonly string[] = frame.success ? TAKEN_IN[frame.data.type] : [];

    if (frame.success && takenIn.includes(this.#handshake.name)) {
      this.#take(frame.data);
    }
  }

  #take(frame: ServerHandshake): void {
    if (frame.type === HANDSHAKE_TYPE.challenge) {
      this.#challenged(frame.nonce, frame.proof);
    } else if (frame.type === HANDSHAKE_TYPE.pairingRequired) {
      // The key stays: whoever says it is unknown proved nothing, and only a key issued after the user's code replaces
      // it. A real server that forgot it just asks for the code again.
      this.#handshake = { name: HANDSHAKE_STATE.pairing };
      this.#observer?.state({ kind: LINK_STATE.pairing, reason: frame.reason, attemptsLeft: frame.attemptsLeft });
    } else if (frame.type === HANDSHAKE_TYPE.paired) {
      this.#key = frame.key;
      this.#handshake = { name: HANDSHAKE_STATE.trusted };
      this.#observer?.paired(frame.key);
    } else {
      this.#backoff.reset();
      this.#handshake = { name: HANDSHAKE_STATE.session };
      this.#observer?.state({ kind: LINK_STATE.connected });
      // Main opens its RPC peer for this socket now, so its plugin info events reach the server (S-012).
      this.#observer?.frame(this.#epoch, LINK_OPENED_FRAME);
    }
  }

  /** The server proves the key over this socket's nonce first; only then does the window prove it back (S-023). */
  #challenged(serverNonce: string, serverProof: string): void {
    const key = this.#key;
    const handshake = this.#handshake;

    if (key === null || handshake.name !== HANDSHAKE_STATE.hello) {
      return;
    }

    if (!Proof.of(serverProof).equals(Proof.sign(key.secret, PROOF_ROLE.server, handshake.nonce, serverNonce))) {
      // Not the server this key was paired with: close, keep the key, and try again later (S-025).
      this.#socket?.close(CLOSE_CODE.unauthorized, LINK_CLOSE_REASON.serverUnproven);
      this.#closed(CLOSE_CODE.unauthorized, LINK_CLOSE_REASON.serverUnproven);

      return;
    }

    this.#handshake = { name: HANDSHAKE_STATE.trusted };
    this.#send({
      type: HANDSHAKE_TYPE.auth,
      proof: Proof.sign(key.secret, PROOF_ROLE.plugin, serverNonce, handshake.nonce).hex(),
    });
  }

  /** The socket closed: the close table says wait and connect again, or stop and say why. */
  #closed(code: number, reason: string): void {
    if (this.#handshake.name === HANDSHAKE_STATE.closed) {
      return;
    }

    const decision = this.#decide(code, reason);

    this.#handshake = { name: HANDSHAKE_STATE.closed };

    if (decision.action === CLOSE_ACTION.stop) {
      this.#observer?.state({ kind: LINK_STATE.stopped, reason: decision.text });

      return;
    }

    const delay = this.#backoff.next();

    this.#observer?.state({ kind: LINK_STATE.waiting, retryInMs: delay, reason: decision.text });
    setTimeout(() => this.#open(), delay);
  }

  /** Stop or retry after a close (P-044, A§5.2), decided by the close table CLOSE_RULES, a Strategy table per code. */
  #decide(code: number, reason: string): CloseDecision {
    const olderServer = (ProtocolReason.parse(reason)?.protocol ?? PROTOCOL) < PROTOCOL;
    const rule = CLOSE_RULES.find((row) => row.code === code && (olderServer || !row.olderServer));

    return { action: rule?.action ?? CLOSE_ACTION.retry, text: rule?.text ?? null };
  }

  #send(frame: PluginHandshake): void {
    this.#socket?.send(JSON.stringify(frame));
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

export const SOCKET_LINK = new InjectionToken<SocketLink>("SocketLink");

export const SOCKET_OPENER = new InjectionToken<SocketOpener>("SocketOpener");

/** Opens a socket to the bridge; what is sent before it is open goes out once it is. */
export interface SocketOpener {
  open(): MessageSocket;
}

/** What the window shows of the link. */
export type LinkState =
  | { readonly kind: typeof LINK_STATE.connecting }
  | { readonly kind: typeof LINK_STATE.pairing; readonly reason: PairingReason; readonly attemptsLeft: number }
  | { readonly kind: typeof LINK_STATE.connected }
  | { readonly kind: typeof LINK_STATE.waiting; readonly retryInMs: number; readonly reason: string | null }
  | { readonly kind: typeof LINK_STATE.stopped; readonly reason: string | null };

/** What the link asks of the window and tells it: the window is its one listener. */
export interface LinkObserver {
  /** Who the plugin is now, for each hello. */
  info(): PluginInfo;
  state(state: LinkState): void;
  /** A key the server issued after the user's code: main stores it in place of the old one. */
  paired(key: PluginKey): void;
  /** A frame of the session on the socket of `epoch`, unread: main's RPC takes it. */
  frame(epoch: number, text: string): void;
}

/** Where one socket's handshake stands: the link's one state field. */
export type Handshake =
  | {
    readonly name: typeof HANDSHAKE_STATE.hello;
    /** This socket's half of the challenge. */
    readonly nonce: string;
  }
  | { readonly name: Exclude<(typeof HANDSHAKE_STATE)[keyof typeof HANDSHAKE_STATE], typeof HANDSHAKE_STATE.hello> };

/** What a close means for the window: try again, or stop; and the sentence that says why, if any. */
interface CloseDecision {
  readonly action: (typeof CLOSE_ACTION)[keyof typeof CLOSE_ACTION];
  readonly text: string | null;
}
