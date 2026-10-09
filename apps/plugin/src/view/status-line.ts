import type { LinkState } from "../types/link.ts";

export interface StatusLine {
  readonly tone: "ok" | "wait" | "error";
  readonly title: string;
  /** What it means for the file, or what to do next. */
  readonly detail: string | null;
}

/**
 * The connection in a word, and in one plain sentence the file the AI sees or what the user should do; what the AI may
 * do with the file is the Allow edits switch's to say.
 */
export function statusLine(link: LinkState, fileName: string): StatusLine {
  switch (link.kind) {
    case "connected":
      return {
        tone: "ok",
        title: "Connected",
        detail: `Your AI assistant sees “${fileName}”.`,
      };
    case "connecting":
      return {
        tone: "wait",
        title: "Connecting…",
        detail: "Looking for Pixelwright on this computer.",
      };
    case "pairing":
      return {
        tone: "wait",
        title: "Pair this window",
        detail: null,
      };
    case "waiting":
      return {
        tone: "wait",
        title: "Not connected",
        detail:
          link.reason ??
          "Start Claude Code, Cursor or another AI app with Pixelwright. This window connects by itself.",
      };
    case "stopped":
      return {
        tone: "error",
        title: "Stopped",
        detail: link.reason,
      };
  }
}

/**
 * Under the Allow edits switch: how long it stays on and how a change is taken back, or that the AI only reads, and
 * that code execute started may outlive the switch (only closing the window stops it).
 */
export function editsNote(allowEdits: boolean, undo: string, ranCode = false): string {
  if (allowEdits) {
    return `AI may change this file until you close this window. Each change is one undo step (${undo}).`;
  }

  return ranCode
    ? "AI only reads this file now. Code it ran with execute keeps running until you close this window."
    : "AI only reads this file.";
}

/** Above the switch after the AI tried to write while it was off; null otherwise. */
export function editsHint(refused: boolean, allowEdits: boolean): string | null {
  return refused && !allowEdits ? "Your AI tried to change this file: turn on Allow edits." : null;
}

/** The line under the code field while pairing; null in any other state. */
export function pairingNote(link: LinkState): string | null {
  if (link.kind !== "pairing") {
    return null;
  }

  switch (link.reason) {
    case "no_key":
      return "Ask your AI assistant for the 6-digit pairing code and type it here.";
    case "unknown_key":
      return "Pixelwright no longer knows this window: ask your assistant for a pairing code and type it here.";
    case "expired":
      return "That code expired: ask your assistant for the new one.";
    case "locked":
      return "Too many wrong codes were typed, maybe by another program: pairing is paused. Ask your assistant again in a few minutes.";
    case "wrong_code":
      return link.attemptsLeft > 0
        ? `Wrong code: ${link.attemptsLeft} ${link.attemptsLeft === 1 ? "try" : "tries"} left.`
        : "Too many wrong codes: ask your assistant for the new code.";
  }
}
