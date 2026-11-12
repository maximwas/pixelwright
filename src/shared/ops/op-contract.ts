import * as zod from "zod/mini";
import type { OpMeta, OpName, PerInput, ResolvedOpMeta } from "@/shared/ops/op-meta.types.ts";

/**
 * One op's contract (A§5.5): its name, its input and output schemas and its meta, plain data the server and the plugin
 * both read. `meta(input)` resolves the per-input values, so the Allow edits guard, the turn, the watchdog and the
 * server's timer all read the same flags (D-07).
 */
export class OpContract<Input extends zod.ZodMiniType, Output extends zod.ZodMiniType> {
  readonly name: OpName;
  readonly input: Input;
  readonly output: Output;
  readonly declared: OpMeta<zod.output<Input>>;

  constructor(definition: OpDefinition<Input, Output>) {
    this.name = definition.name;
    this.input = definition.input;
    this.output = definition.output;
    this.declared = definition.meta;
  }

  meta(input: zod.output<Input>): ResolvedOpMeta {
    const declared = this.declared;

    return {
      write: this.#resolve(declared.write, input),
      dryRun: declared.dryRun,
      timeoutMs: this.#resolve(declared.timeoutMs, input),
      needsAllowEdits: this.#resolve(declared.needsAllowEdits, input),
      turn: declared.turn,
      quiet: declared.quiet ?? false,
    };
  }

  parseInput(raw: unknown): Parsed<zod.output<Input>> {
    return this.#parse(this.input, raw);
  }

  parseOutput(raw: unknown): Parsed<zod.output<Output>> {
    return this.#parse(this.output, raw);
  }

  /** A per-input meta value for this input: as declared, or what its arrow gives. */
  #resolve<Value extends boolean | number>(value: PerInput<zod.output<Input>, Value>, input: zod.output<Input>): Value {
    return typeof value === "function" ? value(input) : value;
  }

  #parse<Schema extends zod.ZodMiniType>(schema: Schema, raw: unknown): Parsed<zod.output<Schema>> {
    const result = zod.safeParse(schema, raw);

    return result.success
      ? { success: true, data: result.data }
      : { success: false, problem: zod.prettifyError(result.error) };
  }
}

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
