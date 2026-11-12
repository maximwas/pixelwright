import { inject, injectable } from "@needle-di/core";
import { LINK_TEXT, PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link.constants.ts";
import type { ConnectedFile, PluginLink, PluginLinkRole, PluginLinkState } from "@/core/ports/plugin-link.port.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
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

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request(): Promise<unknown> {
    throw new PixelwrightError(ERROR_CODE.pluginNotConnected, LINK_TEXT.notConnected);
  }

  role(): PluginLinkRole {
    return PLUGIN_LINK_ROLE.disabled;
  }

  async state(): Promise<PluginLinkState> {
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
