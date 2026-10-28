import { InjectionToken } from "@needle-di/core";
import type { OwnerBridge } from "@/server/adapters/bridge/owner-bridge/owner-bridge.ts";

/** The owner's role: PluginBridge takes it when the port is free, OwnerRouter serves the peers through it. */
export const OWNER_BRIDGE = new InjectionToken<OwnerBridge>("OwnerBridge");
