import type { JSONRPCMessage, MessageExtraInfo, Transport, TransportSendOptions } from "@modelcontextprotocol/server";
import { LOGGED_ERROR_CHARS } from "../constants/logging.ts";
import type { ToolCallLogger } from "../types/logging.ts";

/** A tool call waiting for its answer: the tool, the file it named, and when it came in. */
interface PendingCall {
  readonly tool: string;
  readonly file: string | undefined;
  readonly started: number;
}

/**
 * The MCP transport with every tool call written to the log as it is answered: the tool, the file it named and how
 * long it took, at info; a failed call at warn with the first line of its message; a call the client cancelled at info,
 * forgotten. Arguments and results stay out. What the wrapped transport can do besides sending, it still can.
 */
export class ToolCallLog implements Transport {
  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?: (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void) | undefined;
  readonly hasPerRequestStream?: boolean;
  readonly setProtocolVersion?: (version: string) => void;
  readonly setSupportedProtocolVersions?: (versions: string[]) => void;

  readonly #inner: Transport;
  readonly #logger: ToolCallLogger;
  readonly #pending = new Map<string | number, PendingCall>();

  constructor(inner: Transport, logger: ToolCallLogger) {
    this.#inner = inner;
    this.#logger = logger;

    if (inner.hasPerRequestStream !== undefined) {
      this.hasPerRequestStream = inner.hasPerRequestStream;
    }

    if (inner.setProtocolVersion !== undefined) {
      this.setProtocolVersion = (version) => inner.setProtocolVersion?.(version);
    }

    if (inner.setSupportedProtocolVersions !== undefined) {
      this.setSupportedProtocolVersions = (versions) => inner.setSupportedProtocolVersions?.(versions);
    }
  }

  get sessionId(): string | undefined {
    return this.#inner.sessionId;
  }

  async start(): Promise<void> {
    this.#inner.onclose = () => this.onclose?.();
    this.#inner.onerror = (error) => this.onerror?.(error);
    this.#inner.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
      this.#received(message);
      this.onmessage?.(message, extra);
    };
    await this.#inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    this.#answered(message);
    await this.#inner.send(message, options);
  }

  async close(): Promise<void> {
    await this.#inner.close();
  }

  #received(message: JSONRPCMessage): void {
    if ("method" in message && message.method === "notifications/cancelled") {
      this.#cancelled((message.params as { requestId?: string | number } | undefined)?.requestId);

      return;
    }

    if (!("method" in message) || message.method !== "tools/call" || !("id" in message)) {
      return;
    }

    const params = (message.params ?? {}) as { name?: unknown; arguments?: { file?: unknown } };

    this.#pending.set(message.id, {
      tool: typeof params.name === "string" ? params.name : "unknown",
      file: typeof params.arguments?.file === "string" ? params.arguments.file : undefined,
      started: Date.now(),
    });
  }

  #answered(message: JSONRPCMessage): void {
    const id = "id" in message && !("method" in message) ? message.id : undefined;
    const call = id === undefined ? undefined : this.#pending.get(id);

    if (id === undefined || call === undefined) {
      return;
    }

    this.#pending.delete(id);

    const fields = fieldsOf(call);
    const failure = failureOf(message);

    if (failure === null) {
      this.#logger.info(fields, `tool ${call.tool}`);
    } else {
      this.#logger.warn(
        {
          ...fields,
          error: failure,
        },
        `tool ${call.tool} failed`,
      );
    }
  }

  /** A call the client cancelled: it gets no answer, so it is logged and forgotten now. */
  #cancelled(id: string | number | undefined): void {
    const call = id === undefined ? undefined : this.#pending.get(id);

    if (id === undefined || call === undefined) {
      return;
    }

    this.#pending.delete(id);
    this.#logger.info(fieldsOf(call), `tool ${call.tool} cancelled`);
  }
}

/** The file a call named, and how long it has taken. */
function fieldsOf(call: PendingCall): { file?: string; ms: number } {
  return {
    ...(call.file === undefined ? {} : { file: call.file }),
    ms: Date.now() - call.started,
  };
}

/** The first line of a failed call's message: a JSON-RPC error, or a tool result marked isError. Null: it worked. */
function failureOf(message: JSONRPCMessage): string | null {
  if ("error" in message) {
    return firstLine(message.error.message);
  }

  const result = ("result" in message ? message.result : {}) as {
    isError?: boolean;
    content?: { type?: string; text?: string }[];
  };

  if (!(result.isError ?? false)) {
    return null;
  }

  return firstLine(result.content?.find((part) => part.type === "text")?.text ?? "");
}

function firstLine(text: string): string {
  return (text.split("\n")[0] ?? "").slice(0, LOGGED_ERROR_CHARS);
}
