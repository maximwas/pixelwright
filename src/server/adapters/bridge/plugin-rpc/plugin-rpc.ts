import { type BirpcReturn, createBirpc } from "birpc";
import pTimeout from "p-timeout";
import * as zod from "zod/mini";
import { PLUGIN_RPC_TEXT, SERVER_GRACE_MS } from "@/server/adapters/bridge/plugin-rpc/plugin-rpc.constants.ts";
import type { SessionSocket } from "@/server/adapters/bridge/sessions/bridge-session/bridge-session.types.ts";
import { OpResultSchema, type WireError } from "@/shared/envelope/op-result.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";
import type { OpContract } from "@/shared/ops/op-contract/op-contract.ts";
import { RPC_TIMEOUT_MS } from "@/shared/protocol/rpc.constants.ts";
import type { PluginFunctions, ServerFunctions } from "@/shared/protocol/rpc.types.ts";

/**
 * The owner's RPC peer of one plugin session (A§5.4): birpc over the session's socket after the handshake. A call's
 * deadline is the op's own resolved timeout; the answer must be an envelope and its data must pass the op's output
 * schema (T-002); a failure the plugin answers becomes a PixelwrightError with its code. When the socket closes,
 * every pending call fails PLUGIN_DISCONNECTED (S-009).
 */
export class PluginRpc {
  readonly #rpc: BirpcReturn<PluginFunctions, ServerFunctions>;
  #deliver: (text: string) => void = () => undefined;

  constructor(socket: SessionSocket) {
    this.#rpc = createBirpc<PluginFunctions, ServerFunctions>(
      {},
      {
        // A block, not an expression: birpc awaits what post returns before the call counts as pending.
        post: (text: string) => {
          socket.send(text);
        },
        on: (deliver: (text: string) => void) => {
          this.#deliver = deliver;
        },
        serialize: (value: unknown) => JSON.stringify(value),
        deserialize: (text: string): unknown => JSON.parse(text),
        timeout: RPC_TIMEOUT_MS,
      },
    );
  }

  /** A frame the plugin sent over this session. */
  receive(text: string): void {
    this.#deliver(text);
  }

  async run<Input extends zod.ZodMiniType, Output extends zod.ZodMiniType>(
    contract: OpContract<Input, Output>,
    input: zod.output<Input>,
  ): Promise<zod.output<Output>> {
    const { timeoutMs } = contract.meta(input);
    const answer = await pTimeout(this.#rpc.run(contract.name, input), {
      milliseconds: timeoutMs + SERVER_GRACE_MS,
      message: new PixelwrightError(ERROR_CODE.timeout, PLUGIN_RPC_TEXT.timeout(contract.name, timeoutMs)),
    });
    const result = zod.safeParse(OpResultSchema, answer);

    if (!result.success) {
      throw new PixelwrightError(ERROR_CODE.opFailed, PLUGIN_RPC_TEXT.badEnvelope(contract.name));
    }

    if (!result.data.ok) {
      throw this.#failure(result.data.error);
    }

    const output = contract.parseOutput(result.data.data);

    if (!output.success) {
      throw new PixelwrightError(ERROR_CODE.opFailed, PLUGIN_RPC_TEXT.badOutput(contract.name, output.problem));
    }

    return output.data;
  }

  /** The socket closed: every pending call fails now, not at its timeout. */
  close(): void {
    this.#rpc.$close(new PixelwrightError(ERROR_CODE.pluginDisconnected, PLUGIN_RPC_TEXT.disconnected));
  }

  /** A code this server does not know (a newer plugin's) is kept as OP_FAILED with the plugin's own message. */
  #failure(error: WireError): PixelwrightError {
    const code = zod.safeParse(zod.enum(ERROR_CODE), error.code);

    return new PixelwrightError(code.success ? code.data : ERROR_CODE.opFailed, error.message);
  }
}
