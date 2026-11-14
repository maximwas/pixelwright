import { InjectionToken } from "@needle-di/core";
import type { PLUGIN_ARRIVAL } from "@/core/ports/plugin-link.constants.ts";

export type PluginArrival = (typeof PLUGIN_ARRIVAL)[keyof typeof PLUGIN_ARRIVAL];

/**
 * What the bridge knows of the Figma plugin coming and going, for a call that finds no file connected: the plugin
 * reconnects by itself after its server restarts or changes, so a call just after that waits for it instead of
 * failing. The bridge reports the events; a call asks `wait`.
 */
export interface PluginArrivals {
  /** This server came up on the bridge, as its owner or as a peer of its owner: a plugin is on its way. */
  up(): void;
  /** A file went, or the owner a peer followed went with its files: the plugin reconnects, if it is still open. */
  left(): void;
  /** A file connected: every call that waits for one goes on. */
  arrived(): void;
  /** Waits for a file when a plugin is expected, at most as long as it stays expected; says how the wait ended. */
  wait(): Promise<PluginArrival>;
}

export const PLUGIN_ARRIVALS = new InjectionToken<PluginArrivals>("PluginArrivals");
