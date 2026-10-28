import type * as zod from "zod/mini";
import type { OpMeta, OpName, ResolvedOpMeta } from "@/shared/ops/op-meta.types.ts";

/** One op as its manifest declares it: name, zod/mini schemas, meta. */
export interface OpDefinition<Input extends zod.ZodMiniType, Output extends zod.ZodMiniType> {
  readonly name: OpName;
  readonly input: Input;
  readonly output: Output;
  readonly meta: OpMeta<zod.output<Input>>;
}

/** A value a schema accepted, or the schema's own account of what is wrong. */
export type Parsed<Value> =
  | { readonly success: true; readonly data: Value }
  | { readonly success: false; readonly problem: string };

/** Any op as the catalog and the runner see it, its input unknown until it is parsed. */
export interface AnyOpContract {
  readonly name: OpName;
  readonly input: zod.ZodMiniType;
  readonly output: zod.ZodMiniType;
  readonly declared: OpMeta<never>;
  meta(input: unknown): ResolvedOpMeta;
  parseInput(raw: unknown): Parsed<unknown>;
  parseOutput(raw: unknown): Parsed<unknown>;
}
