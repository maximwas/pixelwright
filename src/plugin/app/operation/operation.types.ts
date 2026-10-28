import type { Operation } from "@/plugin/app/operation/operation.ts";

/** An op's class as the providers list it: the container builds it, every dependency a default parameter. */
export type OperationClass = new () => Operation;
