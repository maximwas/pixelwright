import { OPERATION_SCHEMAS, type OperationName, type OperationRequest, type OperationResult } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { BridgeView } from "../types/mcp.ts";

/** Runs one plugin operation on the file a tool targets and checks the answer against the operation's schema. */
export async function runOp<N extends OperationName>(
  bridge: BridgeView,
  op: N,
  input: OperationRequest<N>,
  file?: string,
): Promise<OperationResult<N>> {
  const target = resolveTarget(bridge.plugins(), file);
  const result = await bridge.request(op, input, target);

  // TypeScript cannot narrow the schema map by a type parameter; the parse is what checks the value.
  return OPERATION_SCHEMAS[op].output.parse(result) as OperationResult<N>;
}
