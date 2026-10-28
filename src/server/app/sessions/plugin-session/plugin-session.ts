import type * as zod from "zod/mini";
import type { PluginLink } from "@/core/ports/plugin-link/plugin-link.port.ts";
import type { OpCall, OpCallStep } from "@/server/app/sessions/plugin-session/plugin-session.types.ts";
import type { OpContract } from "@/shared/ops/op-contract/op-contract.ts";

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

  async run<Input extends zod.ZodMiniType, Output extends zod.ZodMiniType>(
    contract: OpContract<Input, Output>,
    input: zod.output<Input>,
  ): Promise<zod.output<Output>> {
    const output = await this.#handle(
      {
        session: this.id,
        contract,
        input,
        meta: contract.meta(input),
      },
      0,
    );

    // OpResultStep parsed it with this very contract's output schema.
    return output as zod.output<Output>;
  }

  #handle(
    call: OpCall,
    index: number,
  ): Promise<unknown> {
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
