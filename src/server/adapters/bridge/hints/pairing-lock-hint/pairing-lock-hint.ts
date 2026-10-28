import { injectable } from "@needle-di/core";
import type { HintFacts, StatusHint } from "../status-hints/status-hints.types.ts";

/** Pairing is paused after too many wrong codes: someone may be guessing (S-021). */
@injectable()
export class PairingLockHint implements StatusHint {
  applies({ pairing }: HintFacts): boolean {
    return pairing !== null && pairing.lockedForSeconds !== null;
  }

  text({ pairing }: HintFacts): string {
    return `Pairing is paused for ${pairing?.lockedForSeconds} s: too many wrong codes were typed for a waiting plugin, possibly by another program on this computer (a web page can try). Ask the user to wait, then call status again for a new code.`;
  }
}
