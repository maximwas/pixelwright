import type { LinkState } from "../types/link.ts";

export interface StatusLine {
  readonly tone: "ok" | "wait" | "error";
  readonly text: string;
}

export function statusLine(link: LinkState, fileName: string): StatusLine {
  switch (link.kind) {
    case "connected":
      return {
        tone: "ok",
        text: `Connected · ${fileName}`,
      };
    case "connecting":
      return {
        tone: "wait",
        text: "Connecting to Pixelwright…",
      };
    case "pairing":
      return {
        tone: "wait",
        text: "Pair this plugin with Pixelwright",
      };
    case "waiting":
      return {
        tone: "wait",
        text: link.reason ?? "Waiting for the Pixelwright server: start your MCP client with Pixelwright.",
      };
    case "stopped":
      return {
        tone: "error",
        text: link.reason,
      };
  }
}

/** The line under the code field while pairing; null in any other state. */
export function pairingNote(link: LinkState): string | null {
  if (link.kind !== "pairing") {
    return null;
  }

  switch (link.reason) {
    case "no_key":
      return "Ask your AI assistant for the pairing code (it is in status) and type it here.";
    case "unknown_key":
      return "Pixelwright no longer knows this plugin: ask your assistant for a pairing code and type it here.";
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
