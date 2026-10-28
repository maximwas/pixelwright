import type { AnyOpContract } from "@/shared/ops/op-contract/op-contract.types.ts";
import type { ResolvedOpMeta } from "@/shared/ops/op-meta.types.ts";

/** One op of a call on its way to the plugin: the session it is bound to, its contract, input and resolved meta. */
export interface OpCall {
  readonly session: string;
  readonly contract: AnyOpContract;
  readonly input: unknown;
  readonly meta: ResolvedOpMeta;
}

export type OpStepNext = (call: OpCall) => Promise<unknown>;

/** One link of a session's op chain (Chain of Responsibility): the innermost gets the plugin's raw envelope. */
export interface OpCallStep {
  handle(call: OpCall, next: OpStepNext): Promise<unknown>;
}
