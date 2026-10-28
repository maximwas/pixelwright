import * as zod from "zod/mini";
import type { OpDefinition, Parsed } from "@/shared/ops/op-contract/op-contract.types.ts";
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
      write: this.#flag(declared.write, input),
      dryRun: declared.dryRun,
      timeoutMs: this.#number(declared.timeoutMs, input),
      needsAllowEdits: this.#flag(declared.needsAllowEdits, input),
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

  #flag(
    value: PerInput<zod.output<Input>, boolean>,
    input: zod.output<Input>,
  ): boolean {
    return typeof value === "function" ? value(input) : value;
  }

  #number(
    value: PerInput<zod.output<Input>, number>,
    input: zod.output<Input>,
  ): number {
    return typeof value === "function" ? value(input) : value;
  }

  #parse<Schema extends zod.ZodMiniType>(
    schema: Schema,
    raw: unknown,
  ): Parsed<zod.output<Schema>> {
    const result = zod.safeParse(schema, raw);

    return result.success
      ? {
        success: true,
        data: result.data,
      }
      : {
        success: false,
        problem: zod.prettifyError(result.error),
      };
  }
}
