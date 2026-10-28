import { InjectionToken } from "@needle-di/core";
import type { BridgeConfig } from "@/server/adapters/bridge/bridge-config/bridge-config.ts";

export const BRIDGE_CONFIG = new InjectionToken<BridgeConfig>("BridgeConfig");
