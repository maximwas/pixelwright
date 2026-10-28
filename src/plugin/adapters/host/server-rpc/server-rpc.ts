import { inject, injectable } from "@needle-di/core";
import { type BirpcReturn, createBirpc } from "birpc";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { RPC_TIMEOUT_MS } from "@/shared/protocol/rpc.constants.ts";
import type { PluginFunctions, ServerFunctions } from "@/shared/protocol/rpc.types.ts";
import { UI_CHANNEL_NAME } from "@/shared/window/ui-message.constants.ts";

/**
 * Main's RPC peer of the server (A§5.4): one birpc per socket, told apart by the epoch the window stamps on each frame.
 * A frame of a newer socket closes the old peer, and answers go back with their own socket's epoch, so the window
 * drops an answer meant for a socket that is gone (P1).
 */
@injectable()
export class ServerRpc {
  readonly #channel;
  #epoch = -1;
  #rpc: BirpcReturn<ServerFunctions, PluginFunctions> | null = null;
  #deliver: (text: string) => void = () => undefined;

  constructor(channel = inject(UI_CHANNEL)) {
    this.#channel = channel;
  }

  /** Serves `functions` to the server of every socket the window relays from now on. */
  start(functions: PluginFunctions): void {
    this.#channel.onServer((epoch, text) => this.#receive(epoch, text, functions));
  }

  #receive(
    epoch: number,
    text: string,
    functions: PluginFunctions,
  ): void {
    if (epoch !== this.#epoch) {
      this.#rpc?.$close();
      this.#epoch = epoch;
      this.#rpc = this.#open(epoch, functions);
    }

    this.#deliver(text);
  }

  #open(
    epoch: number,
    functions: PluginFunctions,
  ): BirpcReturn<ServerFunctions, PluginFunctions> {
    return createBirpc<ServerFunctions, PluginFunctions>(functions, {
      post: (text: string) =>
        this.#channel.post({
          ch: UI_CHANNEL_NAME.server,
          e: epoch,
          d: text,
        }),
      on: (deliver: (text: string) => void) => {
        this.#deliver = deliver;
      },
      // birpc would send a thrown Error as {} through JSON (P1): keep its name and message.
      serialize: (value: unknown) =>
        JSON.stringify(value, (_key, item: unknown) =>
          item instanceof Error
            ? {
              name: item.name,
              message: item.message,
            }
            : item,
        ),
      deserialize: (text: string): unknown => JSON.parse(text),
      timeout: RPC_TIMEOUT_MS,
    });
  }
}
