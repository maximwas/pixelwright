import { InjectionToken, inject, injectable } from "@needle-di/core";
import { RUNNER_TEXT } from "@/plugin/app/app.constants.ts";
import type { Operation } from "@/plugin/app/operation.ts";
import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import type { OpCatalog } from "@/shared/ops/op-catalog.ts";
import type { AnyOpContract } from "@/shared/ops/op-contract.ts";

/**
 * Runs one op the server asked for (A§6.3): an op the catalog lacks is UNKNOWN_OP; any other goes through the steps,
 * outer first, and the last hands it to the op built for this call. It answers with the envelope and never throws.
 */
@injectable()
export class OperationRunner {
  readonly #catalog;
  readonly #steps;
  readonly #factory;

  constructor(
    catalog = inject(OP_CATALOG),
    steps = inject(OPERATION_STEPS, { multi: true }),
    factory = inject(OPERATION_FACTORY),
  ) {
    this.#catalog = catalog;
    this.#steps = steps;
    this.#factory = factory;
  }

  async run(op: string, input: unknown): Promise<OpResult> {
    const contract = this.#catalog.find(op);

    if (contract === undefined) {
      return { ok: false, error: { code: ERROR_CODE.unknownOp, message: RUNNER_TEXT.unknownOp(op) } };
    }

    return this.#step(0, { contract, input });
  }

  #step(index: number, call: OpCall): Promise<OpResult> {
    const step = this.#steps[index];

    return step === undefined
      ? this.#factory.create(call).run(call.input)
      : step.handle(call, (next) => this.#step(index + 1, next));
  }
}

export const OP_CATALOG = new InjectionToken<OpCatalog>("OpCatalog");

/** The runner's steps, outer first, in the order RuntimeProviders binds them. */
export const OPERATION_STEPS = new InjectionToken<OperationStep>("OperationSteps");

export const OPERATION_FACTORY = new InjectionToken<OperationFactory>("OperationFactory");

export const OPERATION_RUNNER = new InjectionToken<OperationRunner>("OperationRunner");

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
