import { inject, injectable } from "@needle-di/core";
import type { PluginLink, PluginLinkState } from "../../../../core/ports/plugin-link/plugin-link.port.ts";
import { CHANNEL } from "../../../../shared/protocol/channel.constants.ts";
import { STATUS_HINTS } from "../hints/status-hints/status-hints.tokens.ts";

/** The link while the bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): no port is taken, no plugin reaches this server. */
@injectable()
export class NoBridge implements PluginLink {
  readonly #hints;

  constructor(hints = inject(STATUS_HINTS)) {
    this.#hints = hints;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  state(): PluginLinkState {
    return {
      role: "disabled",
      port: CHANNEL.port,
      pairing: null,
      hint: this.#hints.hint({
        role: "disabled",
        port: CHANNEL.port,
        failure: null,
        closeCode: null,
        pairing: null,
        files: 0,
        rejection: null,
      }),
    };
  }
}
