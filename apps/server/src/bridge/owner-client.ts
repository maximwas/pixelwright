import { BRIDGE_PROTOCOL_VERSION, BridgeError, CloseCode, newNonce, proofEquals, proofFor } from "@pixelwright/core";
import WebSocket, { type RawData } from "ws";
import {
  PEER_JOIN_TIMEOUT_MS,
  PEER_PATH,
  PEER_PROTOCOL_VERSION,
  PEER_TIMEOUT_MARGIN_MS,
  REQUEST_TIMEOUT_MS,
} from "../constants/bridge.ts";
import { OwnerToPeerSchema } from "../schemas/peer.ts";
import type {
  ConnectedPlugin,
  OwnerClientOptions,
  OwnerToPeer,
  PairingStatus,
  PeerToOwner,
  PluginLink,
  RequestOptions,
} from "../types/bridge.ts";
import { PendingRequests } from "./pending-requests.ts";

/** One join of the owner: its socket, the nonce this process sent, and how far the owner got. */
interface JoinAttempt {
  readonly socket: WebSocket;
  readonly nonce: string;
  readonly deadline: ReturnType<typeof setTimeout>;
  readonly resolve: (joined: boolean) => void;
  readonly onLost: () => void;
  /** The owner proved the token: before that, nothing it says is believed. */
  proven: boolean;
  /** The owner answered with the plugins' status. */
  joined: boolean;
}

/**
 * This process's way to the plugins while another pixelwright process (another MCP client session) owns the bridge
 * port: it joins the owner as a peer, and the owner hands its operations to the plugins. The owner has to prove it
 * knows bridge.json's token before this process answers with its own proof, so a program squatting on the port learns
 * nothing.
 */
export class OwnerClient implements PluginLink {
  readonly #options: OwnerClientOptions;
  readonly #pending = new PendingRequests();
  #socket: WebSocket | null = null;
  #plugins: readonly ConnectedPlugin[] = [];
  #pairing: PairingStatus | null = null;
  #sequence = 0;
  #lastCloseCode: number | null = null;

  constructor(options: OwnerClientOptions) {
    this.#options = options;
  }

  /** Why the last join or link ended, e.g. 4426 when the owner runs another version; null before any. */
  get lastCloseCode(): number | null {
    return this.#lastCloseCode;
  }

  /**
   * Joins the owner. Resolves true once it answered, false when it refused, could not prove the token or was gone;
   * `onLost` runs when a link that was up drops later, so the caller can take the port over or join the next owner.
   */
  join(onLost: () => void): Promise<boolean> {
    const { port } = this.#options;

    return new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}${PEER_PATH}`, {
        perMessageDeflate: false,
        handshakeTimeout: PEER_JOIN_TIMEOUT_MS,
      });
      const attempt: JoinAttempt = {
        socket,
        nonce: newNonce(),
        // An owner that never answers: dropping the socket closes it, and the close handler resolves false.
        deadline: setTimeout(() => socket.terminate(), PEER_JOIN_TIMEOUT_MS),
        resolve,
        onLost,
        proven: false,
        joined: false,
      };

      socket.on("open", () =>
        this.#send(socket, {
          type: "peer_hello",
          protocol: PEER_PROTOCOL_VERSION,
          pluginProtocol: BRIDGE_PROTOCOL_VERSION,
          nonce: attempt.nonce,
        }),
      );
      socket.on("message", (data: RawData) => this.#received(attempt, data));
      // A refused or broken connection closes right after; the close handler decides.
      socket.on("error", (error) => this.#options.log("owner link error", { error: String(error) }));
      socket.on("close", (code) => this.#closed(attempt, code));
    });
  }

  plugins(): readonly ConnectedPlugin[] {
    return this.#plugins;
  }

  pairing(): PairingStatus | null {
    return this.#pairing;
  }

  request(op: string, input: unknown, { session }: RequestOptions = {}): Promise<unknown> {
    const socket = this.#socket;

    if (socket === null || socket.readyState !== socket.OPEN) {
      return Promise.reject(new BridgeError("PLUGIN_NOT_CONNECTED", "The plugin bridge's owner is not reachable."));
    }

    const id = String(++this.#sequence);
    const answer = this.#pending.track(id, op, REQUEST_TIMEOUT_MS + PEER_TIMEOUT_MARGIN_MS);

    this.#send(socket, {
      type: "request",
      id,
      op,
      input: input ?? null,
      timeoutMs: REQUEST_TIMEOUT_MS,
      ...(session === undefined ? {} : { session }),
    });

    return answer;
  }

  close(): void {
    this.#socket?.close(CloseCode.GoingAway, "peer shutting down");
  }

  /** What the owner says: its proof first; then the plugins' status, and answers. Before its proof, nothing counts. */
  #received(attempt: JoinAttempt, data: RawData): void {
    const message = parse(data);

    if (message === null) {
      return;
    }

    if (message.type === "peer_challenge") {
      this.#challenged(attempt, message);
    } else if (!attempt.proven) {
      attempt.socket.close(CloseCode.Unauthorized, "the owner spoke before proving the token");
    } else if (message.type === "plugin_status") {
      this.#status(attempt, message);
    } else if (message.type === "response") {
      this.#pending.settle(message);
    }
  }

  /** The owner's proof of the token, answered with this process's own; a wrong or second one ends the join. */
  #challenged(attempt: JoinAttempt, message: Extract<OwnerToPeer, { type: "peer_challenge" }>): void {
    const { token } = this.#options;

    if (attempt.proven || !proofEquals(message.proof, proofFor(token, "owner", attempt.nonce, message.nonce))) {
      attempt.socket.close(CloseCode.Unauthorized, "the owner could not prove the token");

      return;
    }

    attempt.proven = true;
    this.#send(attempt.socket, {
      type: "peer_auth",
      proof: proofFor(token, "peer", message.nonce, attempt.nonce),
    });
  }

  /** The plugins as the owner sees them; the first status is the owner's answer: the join is done. */
  #status(attempt: JoinAttempt, message: Extract<OwnerToPeer, { type: "plugin_status" }>): void {
    this.#plugins = message.plugins;
    this.#pairing = message.pairing;

    if (!attempt.joined) {
      attempt.joined = true;
      clearTimeout(attempt.deadline);
      this.#socket = attempt.socket;
      attempt.resolve(true);
    }
  }

  /** The link closed: everything waiting fails; a join that never finished resolves false, a lost one says so. */
  #closed(attempt: JoinAttempt, code: number): void {
    clearTimeout(attempt.deadline);
    this.#lastCloseCode = code;
    this.#plugins = [];
    this.#pairing = null;
    this.#pending.failAll(code);

    if (this.#socket === attempt.socket) {
      this.#socket = null;
    }

    if (attempt.joined) {
      attempt.onLost();
    } else {
      attempt.resolve(false);
    }
  }

  #send(socket: WebSocket, message: PeerToOwner): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

function parse(data: RawData): OwnerToPeer | null {
  try {
    const parsed = OwnerToPeerSchema.safeParse(JSON.parse(data.toString()));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
