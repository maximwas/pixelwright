import { injectable } from "@needle-di/core";
import { PAIRING_LOCK_HINT } from "@/server/adapters/bridge/hints/pairing-lock-hint/pairing-lock-hint.constants.ts";
import type { HintFacts, StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";

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
