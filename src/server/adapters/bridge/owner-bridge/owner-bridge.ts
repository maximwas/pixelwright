import { inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link/plugin-link.constants.ts";
import type { PluginLink, PluginLinkState, ProbeResult } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/bridge-config/bridge-config.tokens.ts";
import { BRIDGE_LISTENER } from "@/server/adapters/bridge/bridge-listener/bridge-listener.tokens.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints/status-hints.tokens.ts";
import { OWNER_FAILURE } from "@/server/adapters/bridge/owner-bridge/owner-bridge.constants.ts";
import { NO_PROBE } from "@/server/adapters/bridge/sessions/bridge-session/bridge-session.constants.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry/session-registry.tokens.ts";

/**
 * The server that owns the bridge's port (A§4.1 step 5): bridge.json first, where keys and the peers' token live, then
 * the port. A bridge that cannot start keeps the reason for status instead of stopping the server. Its state is the
 * session registry's: the files connected, the windows waiting for a code, the plugins turned away.
 */
@injectable()
export class OwnerBridge implements PluginLink {
  readonly #listener;
  readonly #config;
  readonly #sessions;
  readonly #hints;
  #failure: string | null = null;

  constructor(
    listener = inject(BRIDGE_LISTENER),
    config = inject(BRIDGE_CONFIG),
    sessions = inject(SESSION_REGISTRY),
    hints = inject(STATUS_HINTS),
  ) {
    this.#listener = listener;
    this.#config = config;
    this.#sessions = sessions;
    this.#hints = hints;
  }

  async start(): Promise<void> {
    try {
      this.#config.ensure();
      await this.#listener.listen();
    } catch (error) {
      this.#failure = this.#reason(error);
    }
  }

  async close(): Promise<void> {
    await this.#listener.close();
  }

  probe(): Promise<ProbeResult> {
    return this.#sessions.active()?.probe() ?? Promise.resolve(NO_PROBE);
  }

  state(): PluginLinkState {
    const role = this.#failure === null ? PLUGIN_LINK_ROLE.owner : PLUGIN_LINK_ROLE.failed;
    const port = this.#listener.port();
    const pairing = this.#sessions.pairing();
    const files = this.#sessions.files();

    return {
      role,
      port,
      files,
      pairing,
      hint: this.#hints.hint({
        role,
        port,
        failure: this.#failure,
        closeCode: null,
        pairing,
        files: files.length,
        rejection: this.#sessions.rejection(),
        refusal: this.#sessions.refusal(),
      }),
    };
  }

  /** In words for the hint: a taken port says who may hold it. */
  #reason(error: unknown): string {
    if (!(error instanceof Error)) {
      return String(error);
    }

    return (error as NodeJS.ErrnoException).code === OWNER_FAILURE.portTakenCode
      ? OWNER_FAILURE.portTaken(this.#listener.port())
      : error.message;
  }
}
