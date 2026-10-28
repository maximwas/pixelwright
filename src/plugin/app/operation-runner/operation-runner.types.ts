import type { Operation } from "@/plugin/app/operation/operation.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import type { AnyOpContract } from "@/shared/ops/op-contract/op-contract.types.ts";

/** One call on its way through the steps: its contract, and its input (parsed once ContractStep has passed it). */
export interface OpCall {
  readonly contract: AnyOpContract;
  readonly input: unknown;
}

export type OpNext = (call: OpCall) => Promise<OpResult>;

/** One link of the runner's chain (Chain of Responsibility, A§6.3): answers itself or hands the call on. */
export interface OperationStep {
  handle(call: OpCall, next: OpNext): Promise<OpResult>;
}

/** Builds the op for one call in its own child container (ContainerOperationFactory). */
export interface OperationFactory {
  create(call: OpCall): Operation;
}
