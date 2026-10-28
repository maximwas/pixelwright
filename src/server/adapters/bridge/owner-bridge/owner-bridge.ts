import { inject, injectable } from "@needle-di/core";
import type { PluginLink, PluginLinkState } from "../../../../core/ports/plugin-link/plugin-link.port.ts";
import { BRIDGE_CONFIG } from "../bridge-config/bridge-config.tokens.ts";
import { BRIDGE_LISTENER } from "../bridge-listener/bridge-listener.tokens.ts";
import { STATUS_HINTS } from "../hints/status-hints/status-hints.tokens.ts";
import { PAIRING_CODES } from "../pairing-codes/pairing-codes.tokens.ts";

/**
 * The server that owns the bridge's port (A§4.1 step 5): bridge.json first, where keys and the peers' token live, then
 * the port. A bridge that cannot start keeps the reason for status instead of stopping the server.
 */
@injectable()
export class OwnerBridge implements PluginLink {
  readonly #listener;
  readonly #config;
  readonly #pairing;
  readonly #hints;
  #failure: string | null = null;

  constructor(
    listener = inject(BRIDGE_LISTENER),
    config = inject(BRIDGE_CONFIG),
    pairing = inject(PAIRING_CODES),
    hints = inject(STATUS_HINTS),
  ) {
    this.#listener = listener;
    this.#config = config;
    this.#pairing = pairing;
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

  state(): PluginLinkState {
    const role = this.#failure === null ? "owner" : "failed";
    const port = this.#listener.port();
    // shortcut: no window waits until item 03 counts the unpaired sockets, so no code is minted yet.
    const pairing = this.#pairing.status(0);

    return {
      role,
      port,
      pairing,
      hint: this.#hints.hint({
        role,
        port,
        failure: this.#failure,
        closeCode: null,
        pairing,
        // shortcut: sessions arrive in item 06; until then no file is connected.
        files: 0,
        rejection: this.#listener.rejection(),
      }),
    };
  }

  /** In words for the hint: a taken port says who may hold it (item 07 joins such an owner as a peer). */
  #reason(error: unknown): string {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      return `port ${this.#listener.port()} is taken by another program or another Pixelwright server.`;
    }

    return error instanceof Error ? error.message : String(error);
  }
}
