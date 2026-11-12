import { InjectionToken, inject, injectable } from "@needle-di/core";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { UPDATE_CHECK_INTERVAL_MS } from "@/server/app/stores/stores.constants.ts";
import { UPDATE_STATE } from "@/server/app/stores/update-state.ts";

/**
 * The update banner's feed (S-070): asks the update state at start and once a day after, and tells the plugin windows
 * a version to show; a window's dismissal goes back to the state. The plugin itself never goes online. The timer never
 * keeps the process alive: the server ends with its MCP client.
 */
@injectable()
export class UpdateFeed {
  readonly #state;
  readonly #sessions;

  constructor(state = inject(UPDATE_STATE), sessions = inject(SESSION_REGISTRY)) {
    this.#state = state;
    this.#sessions = sessions;
  }

  start(): void {
    this.#sessions.onDismiss((version) => this.#state.dismiss(version));
    void this.#tell();
    setInterval(() => void this.#tell(), UPDATE_CHECK_INTERVAL_MS).unref();
  }

  async #tell(): Promise<void> {
    const version = await this.#state.shown();

    if (version !== null) {
      this.#sessions.announce(version);
    }
  }
}

export const UPDATE_FEED = new InjectionToken<UpdateFeed>("UpdateFeed");
