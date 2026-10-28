import type { CODE_CHECK } from "@/server/adapters/bridge/pairing-codes/pairing-codes.constants.ts";
import type { PairingReason } from "@/shared/protocol/handshake.schema.ts";

/** The one code in force. */
export interface ActiveCode {
  readonly code: string;
  readonly expiresAt: number;
  readonly attemptsLeft: number;
}

/** The body of a pairing_required, in 0.7.0's field order: why, the tries left, and the code's or the pause's time left. */
export interface PairingPrompt {
  readonly reason: PairingReason;
  readonly attemptsLeft: number;
  readonly expiresInMs: number;
}

/** What a typed code earned: a pairing, a spent try, nothing (no code in force), or the pause. */
export type CodeCheck =
  | { readonly outcome: typeof CODE_CHECK.ok }
  | {
    readonly outcome: typeof CODE_CHECK.wrong;
    readonly attemptsLeft: number;
  }
  | { readonly outcome: typeof CODE_CHECK.expired }
  | {
    readonly outcome: typeof CODE_CHECK.locked;
    readonly until: number;
  };

export type CodeOutcome = CodeCheck["outcome"];
