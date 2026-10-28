/** The one code in force. */
export interface ActiveCode {
  readonly code: string;
  readonly expiresAt: number;
  readonly attemptsLeft: number;
}

/** What a typed code earned: a pairing, a spent try, nothing (no code in force), or the pause. */
export type CodeCheck =
  | { readonly outcome: "ok" }
  | {
    readonly outcome: "wrong";
    readonly attemptsLeft: number;
  }
  | { readonly outcome: "expired" }
  | {
    readonly outcome: "locked";
    readonly until: number;
  };
