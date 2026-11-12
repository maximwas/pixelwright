import { type BirpcReturn, createBirpc } from "birpc";
import pTimeout from "p-timeout";
import { PLUGIN_RPC_TEXT, SERVER_GRACE_MS } from "@/server/adapters/bridge/plugin/plugin.constants.ts";
import type { SessionSocket } from "@/server/adapters/bridge/sessions/bridge-session.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { RPC_TIMEOUT_MS } from "@/shared/protocol/rpc.constants.ts";
import type { PluginFunctions, ServerFunctions } from "@/shared/protocol/rpc.types.ts";

/**
 * The owner's RPC peer of one plugin session (A§5.4): birpc over the session's socket after the handshake. A call's
 * deadline is the op's own resolved timeout plus a grace, so the plugin watchdog's own answer comes first; the answer
 * goes back raw, for the plugin session to parse (T-002). When the socket closes, every pending call fails
 * PLUGIN_DISCONNECTED (S-009). The plugin's events reach `functions`.
 */
export class PluginRpc {
  readonly #rpc: BirpcReturn<PluginFunctions, ServerFunctions>;
  #deliver: (text: string) => void = () => undefined;

  constructor(socket: SessionSocket, functions: ServerFunctions) {
    this.#rpc = createBirpc<PluginFunctions, ServerFunctions>(functions, {
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
    });
  }

  /** A frame the plugin sent over this session. */
  receive(text: string): void {
    this.#deliver(text);
  }

  /** The plugin's envelope for one op, unparsed. */
  request(
    op: string,
    input: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    return pTimeout(this.#rpc.run(op, input), {
      milliseconds: timeoutMs + SERVER_GRACE_MS,
      message: new PixelwrightError(ERROR_CODE.timeout, PLUGIN_RPC_TEXT.timeout(op, timeoutMs)),
    });
  }

  /** The socket closed: every pending call fails now, not at its timeout. */
  close(): void {
    this.#rpc.$close(new PixelwrightError(ERROR_CODE.pluginDisconnected, PLUGIN_RPC_TEXT.disconnected));
  }
}
