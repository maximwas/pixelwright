import type { Container } from "@needle-di/core";
import { OP_REPORT } from "@/plugin/app/op-report/op-report.tokens.ts";
import { OpReport } from "@/plugin/app/op-report/op-report.ts";
import type { Operation } from "@/plugin/app/operation/operation.ts";
import type { OperationClass } from "@/plugin/app/operation/operation.types.ts";
import type { OpCall, OperationFactory } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import type { OpName } from "@/shared/ops/op-meta.types.ts";

/**
 * Factory: one op per call, built in a child container that holds the call's own OpReport, so the root keeps its
 * singletons. It sits beside the root, the only other place that holds the container.
 */
export class ContainerOperationFactory implements OperationFactory {
  readonly #root: Container;
  readonly #classes: Readonly<Record<OpName, OperationClass>>;

  constructor(
    root: Container,
    classes: Readonly<Record<OpName, OperationClass>>,
  ) {
    this.#root = root;
    this.#classes = classes;
  }

  create(call: OpCall): Operation {
    // The one place an op is asked for by its class: a fresh instance per call is the point (needle-di #110).
    return this.#root
      .createChild()
      .bind({
        provide: OP_REPORT,
        useClass: OpReport,
      })
      .get(this.#classes[call.contract.name]);
  }
}
