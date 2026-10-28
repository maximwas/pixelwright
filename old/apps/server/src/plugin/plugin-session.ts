import {
  OPERATION_SCHEMAS,
  type OperationName,
  type OperationRequest,
  type OperationResult,
  type PluginInfo,
} from "@pixelwright/core";
import type { BridgeView } from "../types/mcp.ts";

/**
 * The plugin in the one file a tool call works on: every operation of the call goes to that file, even when another
 * file comes to the front meanwhile, and each answer is checked against its operation's schema.
 */
export class PluginSession {
  readonly #bridge: BridgeView;
  readonly #session: string;

  constructor(bridge: BridgeView, session: string) {
    this.#bridge = bridge;
    this.#session = session;
  }

  /** The file as its plugin last told: its name, current page and editor; undefined once the plugin is gone. */
  info(): PluginInfo | undefined {
    return this.#bridge.plugins().find((plugin) => plugin.session === this.#session)?.info;
  }

  /** One operation, its answer checked; `timeoutMs` waits longer than the bridge's default (a long execute). */
  async run<N extends OperationName>(
    op: N,
    input: OperationRequest<N>,
    { timeoutMs }: { readonly timeoutMs?: number } = {},
  ): Promise<OperationResult<N>> {
    const answer = await this.#bridge.request(op, input, {
      session: this.#session,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });

    // TypeScript cannot narrow the schema map by a type parameter; the parse is what checks the answer.
    return OPERATION_SCHEMAS[op].output.parse(answer) as OperationResult<N>;
  }
}
