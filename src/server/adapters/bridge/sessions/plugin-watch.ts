import { inject, injectable } from "@needle-di/core";
import pTimeout from "p-timeout";
import { CLOCK } from "@/core/ports/clock.port.ts";
import type { PluginArrival, PluginArrivals } from "@/core/ports/plugin-arrivals.port.ts";
import { PLUGIN_ARRIVAL } from "@/core/ports/plugin-link.constants.ts";
import { PLUGIN_WINDOW_MS } from "@/server/adapters/bridge/sessions/sessions.constants.ts";

/**
 * The owner's and the peer's shared memory of the plugin coming and going (A§6.1): when this server came up on the
 * bridge and when a file last left, and the calls waiting for a file to connect. A plugin is expected for
 * PLUGIN_WINDOW_MS after either; a call waits for what is left of that, woken by the registry's connect event, not by
 * polling.
 */
@injectable()
export class PluginWatch implements PluginArrivals {
  readonly #clock;
  readonly #waiting = new Set<() => void>();
  #upAt = Number.NEGATIVE_INFINITY;
  #leftAt = Number.NEGATIVE_INFINITY;

  constructor(clock = inject(CLOCK)) {
    this.#clock = clock;
  }

  up(): void {
    this.#upAt = this.#clock.now();
  }

  left(): void {
    this.#leftAt = this.#clock.now();
  }

  arrived(): void {
    for (const wake of this.#waiting) {
      wake();
    }

    this.#waiting.clear();
  }

  async wait(): Promise<PluginArrival> {
    const now = this.#clock.now();
    const remaining = Math.max(this.#upAt, this.#leftAt) + PLUGIN_WINDOW_MS - now;
    const wasHere = now - this.#leftAt < PLUGIN_WINDOW_MS;

    if (remaining <= 0) {
      return PLUGIN_ARRIVAL.absent;
    }

    const arrival = new Promise<boolean>((resolve) => {
      this.#waiting.add(() => resolve(true));
    });

    if (await pTimeout(arrival, { milliseconds: remaining, fallback: () => false })) {
      return PLUGIN_ARRIVAL.arrived;
    }

    return wasHere ? PLUGIN_ARRIVAL.left : PLUGIN_ARRIVAL.absent;
  }
}
