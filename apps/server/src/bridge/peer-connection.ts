import { BRIDGE_PROTOCOL_VERSION, CloseCode, newNonce, proofEquals, proofFor, toWireError } from "@pixelwright/core";
import type { RawData, WebSocket } from "ws";
import { HELLO_TIMEOUT_MS, PEER_PROTOCOL_VERSION } from "../constants/bridge.ts";
import { PeerToOwnerSchema } from "../schemas/peer.ts";
import type { OwnerToPeer, PeerConnectionOptions, PeerToOwner, RequestOptions } from "../types/bridge.ts";

type Stage =
  | { readonly kind: "hello" }
  | { readonly kind: "challenged"; readonly peerNonce: string; readonly ownerNonce: string; readonly newer: boolean }
  | { readonly kind: "joined" };

/**
 * Another pixelwright process (another MCP client session) joining this bridge owner. Both prove they know bridge.json's
 * token by challenge-response, the owner first; then the peer's operations go on to a plugin and the answers come back,
 * and it hears which plugins are connected and what code pairing waits for. A peer that speaks a newer protocol gets the
 * port instead (`onNewer`), once it proved the token: an old server must not keep a newer plugin out.
 */
export class PeerConnection {
  readonly #socket: WebSocket;
  readonly #options: PeerConnectionOptions;
  readonly #deadline: ReturnType<typeof setTimeout>;
  #stage: Stage = { kind: "hello" };

  constructor(socket: WebSocket, options: PeerConnectionOptions) {
    this.#socket = socket;
    this.#options = options;
    this.#deadline = setTimeout(() => socket.close(CloseCode.HelloTimeout, "hello timeout"), HELLO_TIMEOUT_MS);
    socket.on("message", (data: RawData, isBinary: boolean) => this.#onMessage(isBinary ? null : parse(data)));
    socket.on("error", (error) => options.log("peer socket error", { error: String(error) }));
    socket.on("close", () => {
      clearTimeout(this.#deadline);
      options.onClose();
    });
  }

  /** Tells the peer which plugins are connected now and what code pairing waits for. */
  sendStatus(): void {
    if (this.#stage.kind === "joined") {
      this.#send({
        type: "plugin_status",
        plugins: [...this.#options.plugins()],
        pairing: this.#options.pairing(),
      });
    }
  }

  #onMessage(message: PeerToOwner | null): void {
    const stage = this.#stage;

    if (message === null) {
      this.#socket.close(CloseCode.BadMessage, "invalid message");
    } else if (stage.kind === "hello") {
      this.#onHello(message);
    } else if (stage.kind === "challenged") {
      this.#onAuth(stage, message);
    } else if (message.type === "request") {
      this.#relay(message.id, message.op, message.input ?? null, {
        ...(message.session === undefined ? {} : { session: message.session }),
        timeoutMs: message.timeoutMs,
      });
    } else {
      this.#socket.close(CloseCode.BadMessage, `unexpected ${message.type}`);
    }
  }

  #onHello(message: PeerToOwner): void {
    if (message.type !== "peer_hello") {
      this.#socket.close(CloseCode.BadMessage, "expected hello");

      return;
    }

    if (message.protocol < PEER_PROTOCOL_VERSION) {
      this.#socket.close(CloseCode.VersionMismatch, `peer protocol ${PEER_PROTOCOL_VERSION} required`);

      return;
    }

    const ownerNonce = newNonce();

    this.#stage = {
      kind: "challenged",
      peerNonce: message.nonce,
      ownerNonce,
      newer: message.protocol > PEER_PROTOCOL_VERSION || (message.pluginProtocol ?? 0) > BRIDGE_PROTOCOL_VERSION,
    };
    this.#send({
      type: "peer_challenge",
      nonce: ownerNonce,
      proof: proofFor(this.#options.token, "owner", message.nonce, ownerNonce),
    });
  }

  #onAuth(stage: Extract<Stage, { kind: "challenged" }>, message: PeerToOwner): void {
    clearTimeout(this.#deadline);

    const expected = proofFor(this.#options.token, "peer", stage.ownerNonce, stage.peerNonce);

    if (message.type !== "peer_auth" || !proofEquals(message.proof, expected)) {
      this.#socket.close(CloseCode.Unauthorized, "the peer could not prove the token");

      return;
    }

    if (stage.newer) {
      this.#options.onNewer();

      return;
    }

    this.#stage = { kind: "joined" };
    this.sendStatus();
  }

  #relay(id: string, op: string, input: unknown, options: RequestOptions): void {
    this.#options.relay(op, input, options).then(
      (result) =>
        this.#send({
          type: "response",
          id,
          ok: true,
          result: result ?? null,
        }),
      (error: unknown) =>
        this.#send({
          type: "response",
          id,
          ok: false,
          error: toWireError(error),
        }),
    );
  }

  #send(message: OwnerToPeer): void {
    if (this.#socket.readyState === this.#socket.OPEN) {
      this.#socket.send(JSON.stringify(message));
    }
  }
}

function parse(data: RawData): PeerToOwner | null {
  try {
    const parsed = PeerToOwnerSchema.safeParse(JSON.parse(data.toString()));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
