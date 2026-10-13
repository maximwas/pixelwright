import {
  BRIDGE_PROTOCOL_VERSION,
  CloseCode,
  decodeServerToPlugin,
  encode,
  MAX_MESSAGE_BYTES,
  NO_RECONNECT_CODES,
  newNonce,
  PLUGIN_INFO_EVENT,
  type PluginKey,
  type PluginToServer,
  proofEquals,
  proofFor,
  type RequestMessage,
  requiredProtocol,
  type ServerToPlugin,
  toWireError,
} from "@pixelwright/core";
import type { RequestOutcome, SocketLike, SocketLinkOptions } from "../types/link.ts";
import { reconnectDelay } from "./backoff.ts";
import { browserSocket } from "./browser-socket.ts";

const OPEN = 1;

const STOP_REASONS: Readonly<Record<number, string>> = {
  [CloseCode.VersionMismatch]:
    "This plugin and the Pixelwright server speak different versions. Run npx -y pixelwright@latest in a terminal to update the plugin, restart your MCP client, then run the plugin again.",
  [CloseCode.Superseded]: "Another window of this plugin took over the connection.",
};

const UNPROVEN_SERVER = "The program on port 18720 could not prove it is your Pixelwright server.";

/** An older server turned this plugin away: a newer one (another MCP client's, or this one restarted) may take its port. */
const OLDER_SERVER =
  "The Pixelwright server on port 18720 is older than this plugin, maybe another MCP client's: update it (npx -y pixelwright@latest in a terminal) and restart Pixelwright there (/mcp in Claude Code). This window connects by itself once a current server holds the port.";

/** Why the server turned the plugin away for now; it reconnects on its own. */
const RETRY_REASONS: Readonly<Record<number, string>> = {
  [CloseCode.TooManySessions]:
    "Pixelwright has too many connections waiting to pair, maybe another program's: trying again.",
  [CloseCode.HelloTimeout]: "The wait for the pairing code ran out: reconnecting for a new one.",
};

/** How far one connection got: only a trusted server's acknowledgement makes it a session. */
type Handshake =
  /** Hello sent: waiting for a challenge (with a key) or for pairing_required. */
  | { readonly kind: "hello"; readonly nonce: string }
  /** The server proved the key, or issued one after the user's code: its hello_ack is welcome. */
  | { readonly kind: "trusted" }
  /** The user typed a code and it was sent: only now may the server issue a key. */
  | { readonly kind: "pair-sent" }
  | { readonly kind: "pairing" }
  | { readonly kind: "acknowledged" };

/**
 * The plugin's end of the bridge, in the UI iframe: says hello, proves the paired key once the server proved it first
 * (or sends the code the user typed), hands requests to the main code and sends back what it answered, and reconnects
 * with backoff whenever the server goes away.
 */
export class SocketLink {
  readonly #options: SocketLinkOptions;
  #key: PluginKey | null;
  #socket: SocketLike | null = null;
  #handshake: Handshake = {
    kind: "hello",
    nonce: "",
  };
  #infoChanged = false;
  #attempt = 0;
  #stopped = false;
  #cancelRetry: (() => void) | null = null;

  constructor(options: SocketLinkOptions) {
    this.#options = options;
    this.#key = options.key;
  }

  start(): void {
    this.#open();
  }

  /** Tells the server about a new file, page, window visibility or Allow edits, once the session stands. */
  sendInfo(): void {
    if (this.#handshake.kind !== "acknowledged") {
      this.#infoChanged = true;

      return;
    }

    this.#send({
      type: "event",
      name: PLUGIN_INFO_EVENT,
      data: this.#options.info(),
    });
  }

  /** Sends the code the user typed into the window, while the server waits for one. */
  pair(code: string): void {
    if (this.#handshake.kind === "pairing") {
      this.#handshake = { kind: "pair-sent" };
      this.#send({
        type: "pair",
        code,
      });
    }
  }

  stop(): void {
    this.#stopped = true;
    this.#cancelRetry?.();
    this.#socket?.close(1000, "plugin closed");
  }

  #open(): void {
    const socket = (this.#options.createSocket ?? browserSocket)(this.#options.url);
    const nonce = newNonce();

    this.#cancelRetry = null;
    this.#socket = socket;
    this.#handshake = {
      kind: "hello",
      nonce,
    };
    this.#options.onState({ kind: "connecting" });
    socket.onopen = () => {
      if (socket === this.#socket) {
        this.#send({
          type: "hello",
          protocol: BRIDGE_PROTOCOL_VERSION,
          plugin: this.#options.info(),
          keyId: this.#key?.id ?? null,
          nonce,
        });
      }
    };
    socket.onmessage = (event) => {
      if (socket === this.#socket && typeof event.data === "string") {
        this.#onMessage(socket, event.data);
      }
    };
    socket.onclose = (event) => {
      if (socket === this.#socket) {
        this.#onClose(event.code, null, event.reason);
      }
    };
  }

  #onMessage(socket: SocketLike, raw: string): void {
    const message = decodeServerToPlugin(raw);

    if (message !== null) {
      this.#handle(socket, message);
    }
  }

  #handle(socket: SocketLike, message: ServerToPlugin): void {
    const handshake = this.#handshake;

    switch (message.type) {
      case "challenge":
        this.#onChallenge(socket, message.nonce, message.proof);
        break;
      case "pairing_required":
        // The key stays: whoever says it is unknown proved nothing, and only a key issued after the user's code
        // replaces it. A real server that forgot it just asks for the code again on every hello.
        this.#handshake = { kind: "pairing" };
        this.#options.onState({
          kind: "pairing",
          reason: message.reason,
          attemptsLeft: message.attemptsLeft,
        });
        break;
      case "paired":
        // Only after this plugin sent the code the user typed: anything else is not the server it paired with.
        if (handshake.kind === "pair-sent") {
          this.#key = message.key;
          this.#handshake = { kind: "trusted" };
          this.#options.onPaired(message.key);
        }

        break;
      case "hello_ack":
        if (handshake.kind === "trusted") {
          this.#attempt = 0;
          this.#handshake = { kind: "acknowledged" };
          this.#options.onState({
            kind: "connected",
            serverVersion: message.server.version,
          });

          if (this.#infoChanged) {
            this.#infoChanged = false;
            this.sendInfo();
          }
        }

        break;
      case "request":
        if (handshake.kind === "acknowledged") {
          void this.#answer(socket, message);
        }

        break;
      case "event":
        break;
    }
  }

  /** The server proves the key over this plugin's nonce first; only then does the plugin prove it back. */
  #onChallenge(socket: SocketLike, serverNonce: string, serverProof: string): void {
    const handshake = this.#handshake;
    const key = this.#key;

    if (handshake.kind !== "hello" || key === null) {
      return;
    }

    if (!proofEquals(serverProof, proofFor(key.secret, "server", handshake.nonce, serverNonce))) {
      this.#socket = null;
      socket.close(CloseCode.Unauthorized, "the server could not prove the key");
      this.#onClose(CloseCode.GoingAway, UNPROVEN_SERVER);

      return;
    }

    this.#handshake = { kind: "trusted" };
    this.#send({
      type: "auth",
      proof: proofFor(key.secret, "plugin", serverNonce, handshake.nonce),
    });
  }

  /**
   * Answers on the connection the request came in on, never on a newer one: after a reconnect, the server on the other
   * end may be another process whose own request ids start over, and the answer would settle its request instead.
   */
  async #answer(socket: SocketLike, request: RequestMessage): Promise<void> {
    let outcome: RequestOutcome;

    try {
      outcome = await this.#options.onRequest(request);
    } catch (error) {
      outcome = {
        ok: false,
        error: toWireError(error),
      };
    }

    let text: string;

    try {
      text = encode(
        outcome.ok
          ? {
              type: "response",
              id: request.id,
              ok: true,
              result: outcome.result,
            }
          : {
              type: "response",
              id: request.id,
              ok: false,
              error: outcome.error,
            },
      );
    } catch (error) {
      sendOn(
        socket,
        refusal(request.id, "RESULT_NOT_SERIALIZABLE", `The result of ${request.op} cannot be sent: ${String(error)}`),
      );

      return;
    }

    const size = new TextEncoder().encode(text).byteLength;

    if (size <= MAX_MESSAGE_BYTES) {
      sendOn(socket, text);

      return;
    }

    sendOn(
      socket,
      refusal(
        request.id,
        "RESULT_TOO_LARGE",
        `The result of ${request.op} is ${size} bytes, over the bridge's limit of ${MAX_MESSAGE_BYTES}.`,
      ),
    );
  }

  #onClose(code: number, reason: string | null, serverReason: string | null = null): void {
    if (this.#stopped) {
      return;
    }

    const stopReason = STOP_REASONS[code];
    const olderServer =
      code === CloseCode.VersionMismatch && (requiredProtocol(serverReason) ?? Infinity) < BRIDGE_PROTOCOL_VERSION;

    if (olderServer) {
      this.#retry(OLDER_SERVER);

      return;
    }

    if (NO_RECONNECT_CODES.has(code) && stopReason !== undefined) {
      this.#stopped = true;
      this.#options.onState({
        kind: "stopped",
        reason: stopReason,
      });

      return;
    }

    this.#retry(reason ?? RETRY_REASONS[code] ?? null);
  }

  /** Waits with backoff, saying why, then opens a new connection. */
  #retry(retryReason: string | null): void {
    const delay = reconnectDelay(this.#attempt, this.#options.random);
    const schedule =
      this.#options.schedule ??
      ((run: () => void, ms: number) => {
        const timer = setTimeout(run, ms);

        return () => clearTimeout(timer);
      });

    this.#attempt += 1;
    this.#options.onState({
      kind: "waiting",
      retryInMs: delay,
      reason: retryReason,
    });
    this.#cancelRetry = schedule(() => this.#open(), delay);
  }

  #send(message: PluginToServer): void {
    if (this.#socket !== null) {
      sendOn(this.#socket, encode(message));
    }
  }
}

/** A failed response that always encodes. */
function refusal(id: string, code: string, message: string): string {
  return encode({
    type: "response",
    id,
    ok: false,
    error: {
      code,
      message,
    },
  });
}

/** Sends on one socket while it is open; a closed one drops the message, as the server has failed it already. */
function sendOn(socket: SocketLike, text: string): void {
  if (socket.readyState === OPEN) {
    socket.send(text);
  }
}
