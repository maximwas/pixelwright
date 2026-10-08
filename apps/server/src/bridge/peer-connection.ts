import { CloseCode, toWireError } from "@pixelwright/core";
import type { RawData, WebSocket } from "ws";
import { HELLO_TIMEOUT_MS, PEER_PROTOCOL_VERSION } from "../constants/bridge.ts";
import { PeerToOwnerSchema } from "../schemas/peer.ts";
import type { OwnerToPeer, PeerConnectionOptions, PeerToOwner, RequestOptions } from "../types/bridge.ts";

/**
 * Another pixelwright process (another Claude Code session) that joined this bridge owner. Its operations go on to a
 * plugin and the answers come back; it hears which plugins are connected.
 */
export class PeerConnection {
  readonly #socket: WebSocket;
  readonly #options: PeerConnectionOptions;
  readonly #helloTimer: ReturnType<typeof setTimeout>;
  #joined = false;

  constructor(socket: WebSocket, options: PeerConnectionOptions) {
    this.#socket = socket;
    this.#options = options;
    this.#helloTimer = setTimeout(() => socket.close(CloseCode.HelloTimeout, "hello timeout"), HELLO_TIMEOUT_MS);
    socket.on("message", (data: RawData, isBinary: boolean) => this.#onMessage(isBinary ? null : parse(data)));
    socket.on("error", (error) => options.log("peer socket error", { error: String(error) }));
    socket.on("close", () => {
      clearTimeout(this.#helloTimer);
      options.onClose();
    });
  }

  /** Tells the peer which plugins are connected now. */
  sendStatus(): void {
    if (this.#joined) {
      this.#send({
        type: "plugin_status",
        plugins: [...this.#options.plugins()],
      });
    }
  }

  #onMessage(message: PeerToOwner | null): void {
    if (message === null) {
      this.#socket.close(CloseCode.BadMessage, "invalid message");
    } else if (!this.#joined) {
      this.#join(message);
    } else if (message.type === "request") {
      this.#relay(
        message.id,
        message.op,
        message.input ?? null,
        message.session === undefined ? {} : { session: message.session },
      );
    } else {
      this.#socket.close(CloseCode.BadMessage, "duplicate hello");
    }
  }

  #join(message: PeerToOwner): void {
    clearTimeout(this.#helloTimer);

    if (message.type !== "peer_hello") {
      this.#socket.close(CloseCode.BadMessage, "expected hello");

      return;
    }

    if (message.protocol !== PEER_PROTOCOL_VERSION) {
      this.#socket.close(CloseCode.VersionMismatch, `peer protocol ${PEER_PROTOCOL_VERSION} required`);

      return;
    }

    this.#joined = true;
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
