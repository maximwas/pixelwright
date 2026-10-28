import { InjectionToken } from "@needle-di/core";
import type { PairingCodes } from "./pairing-codes.ts";

export const PAIRING_CODES = new InjectionToken<PairingCodes>("PairingCodes");
