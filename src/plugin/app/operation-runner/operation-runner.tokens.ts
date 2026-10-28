import { InjectionToken } from "@needle-di/core";
import type { OperationRunner } from "@/plugin/app/operation-runner/operation-runner.ts";
import type { OperationFactory, OperationStep } from "@/plugin/app/operation-runner/operation-runner.types.ts";
import type { OpCatalog } from "@/shared/ops/op-catalog/op-catalog.ts";

export const OP_CATALOG = new InjectionToken<OpCatalog>("OpCatalog");

/** The runner's steps, outer first, in the order RuntimeProviders binds them. */
export const OPERATION_STEPS = new InjectionToken<OperationStep>("OperationSteps");

export const OPERATION_FACTORY = new InjectionToken<OperationFactory>("OperationFactory");

export const OPERATION_RUNNER = new InjectionToken<OperationRunner>("OperationRunner");
