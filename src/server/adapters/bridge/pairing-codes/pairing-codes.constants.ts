/** How long a code is good for: time to read it out and type it, too short to guess through (S-020). */
export const PAIRING_CODE_TTL_MS = 120_000;

/** Wrong tries one code allows, from every waiting window together, before pairing pauses (S-020). */
export const PAIRING_ATTEMPTS = 5;

/** The first pause after a code's tries run out; each further spent code doubles it (S-021, D-09). */
export const PAIRING_LOCK_MS = 30_000;

/** The longest pause: a guesser gets a handful of tries an hour, the user waits at most this long. */
export const PAIRING_MAX_LOCK_MS = 3_600_000;

/** What a typed code earned. */
export const CODE_CHECK = {
  /** The right code: a pairing. */
  ok: "ok",
  /** A wrong one: a try spent. */
  wrong: "wrong",
  /** No code in force: none minted yet, or it expired. */
  expired: "expired",
  /** Pairing is paused. */
  locked: "locked",
} as const;

/** A code shorter than its digits is padded with this in front. */
export const PAIRING_CODE_PAD = "0";

export const PAIRING_LOG = {
  minted: "pairing code minted",
  locked: "pairing locked: a code's tries are spent",
} as const;
