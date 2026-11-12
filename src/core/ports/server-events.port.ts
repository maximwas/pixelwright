import { InjectionToken } from "@needle-di/core";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";

/** What the plugin tells the server unasked (S-012): sent to the current socket, dropped while there is none. */
export interface ServerEvents {
  pluginInfo(info: PluginInfoUpdate): void;
  /** Calls `listener` each time a new socket's session starts. */
  onOpen(listener: () => void): void;
}

export const SERVER_EVENTS = new InjectionToken<ServerEvents>("ServerEvents");
