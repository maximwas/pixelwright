import { injectable } from "@needle-di/core";
import type { HintFacts, StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";
import { PAIRING_LOCK_HINT } from "./pairing-lock-hint.constants.ts";

/** Pairing is paused after too many wrong codes: someone may be guessing (S-021). */
@injectable()
export class PairingLockHint implements StatusHint {
  applies({ pairing }: HintFacts): boolean {
    return pairing !== null && pairing.lockedForSeconds !== null;
  }

  text({ pairing }: HintFacts): string {
    return PAIRING_LOCK_HINT.text(pairing?.lockedForSeconds);
  }
}
