import type { Container } from "@needle-di/core";
import type { OperationClass } from "@/plugin/app/operation/operation.types.ts";
import { OPERATION_FACTORY } from "@/plugin/app/operation-runner/operation-runner.tokens.ts";
import { ContainerOperationFactory } from "@/plugin/main/container-operation-factory/container-operation-factory.ts";
import { PingOperation } from "@/plugin/operations/ping/ping.operation.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import type { OpName } from "@/shared/ops/op-meta.types.ts";

/** Every op's class by name (A§4b.3): a contract without one here fails to type, so no op is left unserved. */
export class OperationProviders {
  readonly #classes: Readonly<Record<OpName, OperationClass>> = {
    [OP_NAME.ping]: PingOperation,
  };

  register(container: Container): void {
    container.bind({
      provide: OPERATION_FACTORY,
      useFactory: () => new ContainerOperationFactory(container, this.#classes),
    });
  }
}
