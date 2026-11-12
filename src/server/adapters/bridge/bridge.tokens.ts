import { InjectionToken } from "@needle-di/core";
import type { BridgeSettings } from "@/server/adapters/bridge/bridge.types.ts";

export const BRIDGE_SETTINGS = new InjectionToken<BridgeSettings>("BridgeSettings");
