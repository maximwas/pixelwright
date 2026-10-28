import { InjectionToken } from "@needle-di/core";
import type { BridgeConfig } from "./bridge-config.ts";

export const BRIDGE_CONFIG = new InjectionToken<BridgeConfig>("BridgeConfig");
