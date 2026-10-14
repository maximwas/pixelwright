import type { OperationName, OperationRequest, OperationResult } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { BridgeView } from "../types/mcp.ts";
import { PluginSession } from "./plugin-session.ts";

/**
 * The plugin as the server's features call it: one operation on the file a tool targets (the active one, or the one
 * named by session or name), its answer checked against the operation's schema before a feature sees it.
 */
export class PluginClient {
  readonly #bridge: BridgeView;

  constructor(bridge: BridgeView) {
    this.#bridge = bridge;
  }

  /** The plugin in the file a tool call targets, found once: a call of several operations keeps to that file. */
  session(file?: string): PluginSession {
    return new PluginSession(this.#bridge, resolveTarget(this.#bridge.plugins(), file).session);
  }

  /** One operation on the file a tool targets. */
  run<N extends OperationName>(op: N, input: OperationRequest<N>, file?: string): Promise<OperationResult<N>> {
    return this.session(file).run(op, input);
  }
}
