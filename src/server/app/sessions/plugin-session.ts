import { InjectionToken } from "@needle-di/core";
import type * as zod from "zod/mini";
import type { PluginLink } from "@/core/ports/plugin-link.port.ts";
import type { AnyOpContract, OpContract } from "@/shared/ops/op-contract.ts";
import type { ResolvedOpMeta } from "@/shared/ops/op-meta.types.ts";

type Schema = zod.ZodMiniType;

/**
 * One call's file (T-002): every op of the call goes to this session, even when another file comes to the front
 * meanwhile. Each op passes the session's chain (log, timeout text, result check) to the link and back, so a tool
 * gets data its op's output schema accepted.
 */
export class PluginSession {
  readonly id: string;
  readonly #link: PluginLink;
  readonly #steps: readonly OpCallStep[];

  constructor(
    id: string,
    link: PluginLink,
    steps: readonly OpCallStep[],
  ) {
    this.id = id;
    this.#link = link;
    this.#steps = steps;
  }

  async run<Input extends Schema, Output extends Schema>(op: OpContract<Input, Output>, input: zod.output<Input>) {
    const output = await this.#handle({ session: this.id, contract: op, input, meta: op.meta(input) }, 0);

    // OpResultStep parsed it with this very contract's output schema.
    return output as zod.output<Output>;
  }

  #handle(call: OpCall, index: number): Promise<unknown> {
    const step = this.#steps[index];

    return step === undefined
      ? this.#link.request({
        session: call.session,
        op: call.contract.name,
        input: call.input,
        timeoutMs: call.meta.timeoutMs,
      })
      : step.handle(call, (next) => this.#handle(next, index + 1));
  }
}

/** The session one call is bound to (T-002): bound per call in the tool's child container, for tools that take `file`. */
export const PLUGIN_SESSION = new InjectionToken<PluginSession>("PluginSession");

/** A session's op chain, outermost first, in the order the composition root binds them. */
export const OP_CALL_STEPS = new InjectionToken<OpCallStep>("OpCallSteps");

/** One op of a call on its way to the plugin: the session it is bound to, its contract, input and resolved meta. */
export interface OpCall {
  readonly session: string;
  readonly contract: AnyOpContract;
  readonly input: unknown;
  readonly meta: ResolvedOpMeta;
}

export type OpStepNext = (call: OpCall) => Promise<unknown>;

/** One link of a session's op chain (Chain of Responsibility): the innermost gets the plugin's raw envelope. */
export interface OpCallStep {
  handle(call: OpCall, next: OpStepNext): Promise<unknown>;
}
