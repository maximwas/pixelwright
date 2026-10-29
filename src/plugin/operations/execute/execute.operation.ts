import { inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import type * as zod from "zod/mini";
import { CODE_FIGMA } from "@/plugin/adapters/figma/code-figma.ts";
import { CHANGE_JOURNAL } from "@/plugin/app/journal/change-journal.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { CodeBody } from "@/plugin/operations/execute/code-body.ts";
import { CodeConsole } from "@/plugin/operations/execute/code-console.ts";
import { CODE_SCOPE } from "@/plugin/operations/execute/code-scope.ts";
import { CodeValue } from "@/plugin/operations/execute/code-value.ts";
import { CODE_TEXT, TIMED_OUT } from "@/plugin/operations/execute/execute.constants.ts";
import type { executeOp } from "@/shared/ops/execute/execute.manifest.ts";

type ExecuteInput = zod.output<typeof executeOp.input>;

type ExecuteOutput = zod.output<typeof executeOp.output>;

/**
 * Code as the body of an async function given figma, a console that keeps what it prints, and pw (T-150, T-154): its
 * value made JSON-safe, or what it threw, or that it ran past its time; it may still be running then, since a plugin
 * cannot stop it (T-156). The journal counts what Figma reports while it runs as Pixelwright's (A§15.9). EditsStep has
 * refused it already while Allow edits is off.
 */
@injectable()
export class ExecuteOperation extends Operation<ExecuteInput, ExecuteOutput> {
  readonly #figma;
  readonly #scope;
  readonly #journal;

  constructor(
    report = inject(OP_REPORT),
    figma = inject(CODE_FIGMA),
    scope = inject(CODE_SCOPE),
    journal = inject(CHANGE_JOURNAL),
  ) {
    super(report);
    this.#figma = figma;
    this.#scope = scope;
    this.#journal = journal;
  }

  protected async execute(input: ExecuteInput): Promise<ExecuteOutput> {
    const values = new CodeValue(this.#figma.mixed());
    const ended = this.#journal.executing();

    try {
      return await this.#figma.around(async () => await this.#ran(input, values));
    } finally {
      ended();
    }
  }

  async #ran({ code, timeoutMs }: ExecuteInput, values: CodeValue): Promise<ExecuteOutput> {
    const output = new CodeConsole(values);
    const body = new CodeBody(values);

    try {
      const run = body.compiled(code)(this.#figma.api(), output.console(), this.#scope.with(this.#figma.helpers()));
      const value = await pTimeout(run, { milliseconds: timeoutMs, fallback: () => TIMED_OUT });

      return value === TIMED_OUT
        ? { result: null, logs: output.kept(), error: CODE_TEXT.ranPast(timeoutMs) }
        : { result: values.result(value), logs: output.kept() };
    } catch (error) {
      return { result: null, logs: output.kept(), error: await body.explained(error, code) };
    }
  }
}
