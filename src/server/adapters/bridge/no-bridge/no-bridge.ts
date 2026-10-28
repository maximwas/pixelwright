import { inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link/plugin-link.constants.ts";
import type { PluginLink, PluginLinkState, ProbeResult } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints/status-hints.tokens.ts";
import { NO_PROBE } from "@/server/adapters/bridge/sessions/bridge-session/bridge-session.constants.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** The link while the bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): no port is taken, no plugin reaches this server. */
@injectable()
export class NoBridge implements PluginLink {
  readonly #hints;

  constructor(hints = inject(STATUS_HINTS)) {
    this.#hints = hints;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async probe(): Promise<ProbeResult> {
    return NO_PROBE;
  }

  state(): PluginLinkState {
    return {
      role: PLUGIN_LINK_ROLE.disabled,
      port: CHANNEL.port,
      files: [],
      pairing: null,
      hint: this.#hints.hint({
        role: PLUGIN_LINK_ROLE.disabled,
        port: CHANNEL.port,
        failure: null,
        closeCode: null,
        pairing: null,
        files: 0,
        rejection: null,
        refusal: null,
      }),
    };
  }
}
