/** The 4426 close reason, 0.7.0's words: every version writes and reads it the same way (memory d9640dee). */
export const PROTOCOL_REASON_TEXT = {
  required: (protocol: number) => `protocol ${protocol} required`,
  /** `protocol N required`, and nothing else. */
  pattern: /^protocol (\d+) required$/,
} as const;
