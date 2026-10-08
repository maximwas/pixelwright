import {
  BRIDGE_PROTOCOL_VERSION,
  CloseCode,
  decodeServerToPlugin,
  encode,
  MAX_MESSAGE_BYTES,
  NO_RECONNECT_CODES,
  PLUGIN_INFO_EVENT,
  type PluginToServer,
  type RequestMessage,
  toWireError,
} from "@pixelwright/core";
import type { RequestOutcome, SocketLike, SocketLinkOptions } from "../types/link.ts";
import { reconnectDelay } from "./backoff.ts";
import { browserSocket } from "./browser-socket.ts";

const OPEN = 1;

const STOP_REASONS: Readonly<Record<number, string>> = {
  [CloseCode.VersionMismatch]:
    "This plugin and the Pixelwright server speak different protocol versions: update the older one, then run the plugin again.",
  [CloseCode.Superseded]: "Another window of this plugin took over the connection.",
};

/**
 * The plugin's end of the bridge, in the UI iframe: says hello, hands requests to the main code and sends back what it
 * answered, and reconnects with backoff whenever the server goes away.
 */
export class SocketLink {
  readonly #options: SocketLinkOptions;
  #socket: SocketLike | null = null;
  #attempt = 0;
  #acknowledged = false;
  #stopped = false;

  constructor(options: SocketLinkOptions) {
    this.#options = options;
  }

  start(): void {
    this.#open();
  }

  /** Tells the server about a new file, page, window visibility or Allow edits; nothing before the hello is answered. */
  sendInfo(): void {
    if (this.#acknowledged) {
      this.#send({
        type: "event",
        name: PLUGIN_INFO_EVENT,
        data: this.#options.info(),
      });
    }
  }

  stop(): void {
    this.#stopped = true;
    this.#socket?.close(1000, "plugin closed");
  }

  #open(): void {
    const socket = (this.#options.createSocket ?? browserSocket)(this.#options.url);

    this.#socket = socket;
    this.#acknowledged = false;
    this.#options.onState({ kind: "connecting" });
    socket.onopen = () => {
      if (socket === this.#socket) {
        this.#send({
          type: "hello",
          protocol: BRIDGE_PROTOCOL_VERSION,
          plugin: this.#options.info(),
        });
      }
    };
    socket.onmessage = (event) => {
      if (socket === this.#socket && typeof event.data === "string") {
        this.#onMessage(event.data);
      }
    };
    socket.onclose = (event) => {
      if (socket === this.#socket) {
        this.#onClose(event.code);
      }
    };
  }

  #onMessage(raw: string): void {
    const message = decodeServerToPlugin(raw);

    if (message?.type === "hello_ack") {
      this.#attempt = 0;
      this.#acknowledged = true;
      this.#options.onState({
        kind: "connected",
        serverVersion: message.server.version,
      });
    } else if (message?.type === "request") {
      void this.#answer(message);
    }
  }

  async #answer(request: RequestMessage): Promise<void> {
    let outcome: RequestOutcome;

    try {
      outcome = await this.#options.onRequest(request);
    } catch (error) {
      outcome = {
        ok: false,
        error: toWireError(error),
      };
    }

    const text = encode(
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
    const size = new TextEncoder().encode(text).byteLength;

    if (size <= MAX_MESSAGE_BYTES) {
      this.#sendText(text);

      return;
    }

    this.#send({
      type: "response",
      id: request.id,
      ok: false,
      error: {
        code: "RESULT_TOO_LARGE",
        message: `The result of ${request.op} is ${size} bytes, over the bridge's limit of ${MAX_MESSAGE_BYTES}.`,
      },
    });
  }

  #onClose(code: number): void {
    this.#acknowledged = false;

    if (this.#stopped) {
      return;
    }

    const reason = STOP_REASONS[code];

    if (NO_RECONNECT_CODES.has(code) && reason !== undefined) {
      this.#stopped = true;
      this.#options.onState({
        kind: "stopped",
        reason,
      });

      return;
    }

    const delay = reconnectDelay(this.#attempt, this.#options.random);
    const schedule = this.#options.schedule ?? ((run: () => void, ms: number) => void setTimeout(run, ms));

    this.#attempt += 1;
    this.#options.onState({
      kind: "waiting",
      retryInMs: delay,
    });
    schedule(() => this.#open(), delay);
  }

  #send(message: PluginToServer): void {
    this.#sendText(encode(message));
  }

  #sendText(text: string): void {
    if (this.#socket?.readyState === OPEN) {
      this.#socket.send(text);
    }
  }
}
