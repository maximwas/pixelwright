import { OPERATION_SCHEMAS, type OperationName, type OperationRequest, type OperationResult } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { BridgeView } from "../types/mcp.ts";

/**
 * The plugin as the server's features call it: one operation on the file a tool targets (the active one, or the one
 * named by session or name), its answer checked against the operation's schema before a feature sees it.
 */
export class PluginClient {
  readonly #bridge: BridgeView;

  constructor(bridge: BridgeView) {
    this.#bridge = bridge;
  }

  async run<N extends OperationName>(op: N, input: OperationRequest<N>, file?: string): Promise<OperationResult<N>> {
    const target = resolveTarget(this.#bridge.plugins(), file);
    const answer = await this.#bridge.request(op, input, target);

    // TypeScript cannot narrow the schema map by a type parameter; the parse is what checks the answer.
    return OPERATION_SCHEMAS[op].output.parse(answer) as OperationResult<N>;
  }
}
