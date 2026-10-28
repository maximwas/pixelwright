import { InjectionToken } from "@needle-di/core";
import type { PairingStore } from "@/plugin/adapters/host/pairing-store/pairing-store.ts";

export const PAIRING_STORE = new InjectionToken<PairingStore>("PairingStore");
