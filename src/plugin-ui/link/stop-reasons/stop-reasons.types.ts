import type { CLOSE_ACTION } from "@/plugin-ui/link/stop-reasons/stop-reasons.constants.ts";

/** What a close means for the window: try again, or stop; and the sentence that says why, if any. */
export interface CloseDecision {
  readonly action: (typeof CLOSE_ACTION)[keyof typeof CLOSE_ACTION];
  readonly text: string | null;
}
