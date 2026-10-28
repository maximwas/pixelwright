import { PAIRING_REASON } from "@/shared/protocol/handshake.constants.ts";
import type { PairingReason } from "@/shared/protocol/handshake.schema.ts";

/** The ids of ui.html's elements the window fills in. */
export const WINDOW_ELEMENT = {
  brand: "brand",
  dot: "dot",
  title: "title",
  detail: "detail",
  pairing: "pairing",
  code: "code",
  pairingNote: "pairing-note",
  allowEdits: "allow-edits",
} as const;

/** The status dot's colour: connected, on its way, stopped. */
export const TONE = {
  ok: "ok",
  wait: "wait",
  error: "error",
} as const;

/** The form event of the code field, and the document state of a window whose file tab is in front. */
export const WINDOW_EVENT = {
  submit: "submit",
  change: "change",
  visible: "visible",
} as const;

/** What the window says of the link, 0.7.0's words (P-041, P-044). */
export const STATUS_TEXT = {
  connecting: "Connecting…",
  lookingForServer: "Looking for Pixelwright on this computer.",
  notConnected: "Not connected",
  startServer: "Start Claude Code, Cursor or another AI app with Pixelwright. This window connects by itself.",
  pairing: "Pair this window",
  connected: (fileName: string) => `Connected (${fileName})`,
  seesFile: "Your AI assistant sees this file.",
  stopped: "Stopped",
} as const;

/** The line under the code field, by the server's reason for asking (P-041). */
export const PAIRING_NOTE = {
  [PAIRING_REASON.noKey]: () => "Ask your AI assistant for the 6-digit pairing code and type it here.",
  [PAIRING_REASON.unknownKey]: () =>
    "Pixelwright no longer knows this window: ask your assistant for a pairing code and type it here.",
  [PAIRING_REASON.expired]: () => "That code expired: ask your assistant for the new one.",
  [PAIRING_REASON.locked]: () =>
    "Too many wrong codes were typed, maybe by another program: pairing is paused. Ask your assistant again in a few minutes.",
  [PAIRING_REASON.wrongCode]: (attemptsLeft: number) =>
    attemptsLeft > 0
      ? `Wrong code: ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`
      : "Too many wrong codes: ask your assistant for the new code.",
} as const satisfies Record<PairingReason, (attemptsLeft: number) => string>;

export const WINDOW_ERROR = {
  missing: (id: string) => `ui.html has no element #${id}`,
} as const;

/** Anything but a digit, which the code field drops from what was typed or pasted. */
export const NOT_A_DIGIT = /\D/g;
