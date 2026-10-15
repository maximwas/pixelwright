/**
 * The most JSON one snapshot builds before it stops adding layers: a third of the bridge's message limit, as text in
 * other scripts takes up to three bytes a character. design_read shows far less than this anyway.
 */
export const SNAPSHOT_MAX_CHARS = 1_000_000;
