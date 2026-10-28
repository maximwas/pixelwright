import { InjectionToken } from "@needle-di/core";
import type { PluginConnections } from "@/server/adapters/bridge/plugin-connections/plugin-connections.ts";

export const PLUGIN_CONNECTIONS = new InjectionToken<PluginConnections>("PluginConnections");
