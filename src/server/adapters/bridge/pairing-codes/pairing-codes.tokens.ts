import { InjectionToken } from "@needle-di/core";
import type { PairingCodes } from "@/server/adapters/bridge/pairing-codes/pairing-codes.ts";

export const PAIRING_CODES = new InjectionToken<PairingCodes>("PairingCodes");
