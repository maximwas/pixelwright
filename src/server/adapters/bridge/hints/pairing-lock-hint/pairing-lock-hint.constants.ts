/** The hint while pairing is paused after too many wrong codes: someone may be guessing (S-021). */
export const PAIRING_LOCK_HINT = {
  text: (lockedForSeconds: number | null | undefined) =>
    `Pairing is paused for ${lockedForSeconds} s: too many wrong codes were typed for a waiting plugin, possibly by another program on this computer (a web page can try). Ask the user to wait, then call status again for a new code.`,
} as const;
