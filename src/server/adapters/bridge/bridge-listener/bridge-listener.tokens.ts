import { InjectionToken } from "@needle-di/core";
import type { BridgeListener } from "./bridge-listener.ts";

export const BRIDGE_LISTENER = new InjectionToken<BridgeListener>("BridgeListener");
