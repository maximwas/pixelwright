import type * as z from "zod";
import type { OPERATION_SCHEMAS } from "../schemas/operations.ts";

export type OperationName = keyof typeof OPERATION_SCHEMAS;

export type OperationInput<N extends OperationName> = z.output<(typeof OPERATION_SCHEMAS)[N]["input"]>;

export type OperationOutput<N extends OperationName> = z.input<(typeof OPERATION_SCHEMAS)[N]["output"]>;

/** What the server gets back from an operation, once parsed. */
export type OperationResult<N extends OperationName> = z.output<(typeof OPERATION_SCHEMAS)[N]["output"]>;
