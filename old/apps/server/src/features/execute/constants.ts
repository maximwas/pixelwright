/** How much longer than the code's own time the server waits for the plugin's answer: its logs and result. */
export const EXECUTE_ANSWER_MARGIN_MS = 5_000;

/** What code that only reads is told: reads need no code. It speaks of the code, never of the file. */
export const READS_ONLY_NOTE =
  "This code only reads: design_read, inspect, measure and nodes_find read without code, and work while Allow edits is off.";
