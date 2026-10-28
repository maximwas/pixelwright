/** execute's numbers both sides read (T-150, T-156), each with its reason. */
export const EXECUTE = {
  /** The longest code execute takes: a long script fits, a runaway reply does not; more goes in a script file. */
  codeChars: 100_000,
  /** The longest execute waits for its code: five minutes, for a long task. */
  maxMs: 300_000,
  /** How long execute waits for its code when the call does not say. */
  defaultMs: 10_000,
  /** How much longer than the code's own time the server waits for the plugin's answer: its logs and result. */
  answerMarginMs: 5_000,
} as const;
