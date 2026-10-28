import { InjectionToken } from "@needle-di/core";
import type { BridgeListener } from "@/server/adapters/bridge/bridge-listener/bridge-listener.ts";

export const BRIDGE_LISTENER = new InjectionToken<BridgeListener>("BridgeListener");
