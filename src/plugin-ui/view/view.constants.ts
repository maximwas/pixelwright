import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import type { OpName } from "@/shared/ops/op-meta.types.ts";
import { PAIRING_REASON } from "@/shared/protocol/handshake.constants.ts";
import type { PairingReason } from "@/shared/protocol/handshake.schema.ts";

/** The ids of ui.html's elements the window fills in. */
export const WINDOW_ELEMENT = {
  root: "window",
  brand: "brand",
  dot: "dot",
  title: "title",
  detail: "detail",
  pairing: "pairing",
  code: "code",
  pairingNote: "pairing-note",
  hint: "hint",
  allowEdits: "allow-edits",
  editsNote: "edits-note",
  actions: "actions",
  support: "support",
  feedback: "feedback",
} as const;

/** The elements the window builds itself: the activity's lines and the links. */
export const WINDOW_TAG = { item: "li", text: "span", link: "a" } as const;

/** ui.html's classes of an activity line. */
export const ACTION_CLASS = { what: "what", when: "when", warning: "warning", empty: "empty" } as const;

/** The status dot's colour: connected, on its way, stopped. */
export const TONE = { ok: "ok", wait: "wait", error: "error" } as const;

/** The form event of the code field, and the document state of a window whose file tab is in front. */
export const WINDOW_EVENT = {
  submit: "submit",
  change: "change",
  click: "click",
  visible: "visible",
  visibilityChange: "visibilitychange",
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

/** What the window says of Allow edits (P-053, P-012), 0.7.0's words. */
export const EDITS_TEXT = {
  on: (undo: string) =>
    `AI may change this file until you turn this off, also in later sessions on this computer. Each change is one undo step (${undo}).`,
  off: "AI only reads this file.",
  offWhileCodeRuns: "AI only reads this file now. Code it ran with execute keeps running until you close this window.",
  refused: "Your AI tried to change this file: turn on Allow edits.",
} as const;

/** The undo shortcut of the system Figma runs on, told apart by the user agent. */
export const UNDO_KEY = { macAgent: "Mac", mac: "⌘Z", other: "Ctrl+Z" } as const;

/** What the activity calls an op (P-051); an op not here goes by its name. */
export const ACTION_NAME: Partial<Record<OpName, string>> = {
  [OP_NAME.selection]: "Read the selection",
  [OP_NAME.changes]: "Read the changes",
  [OP_NAME.execute]: "Ran code",
};

export const ACTIVITY_TEXT = {
  failed: (name: string) => `${name} — failed`,
  refused: "Edit refused: Allow edits is off",
  nothingYet: "Nothing yet",
} as const;

/** How many of the last actions the window lists (P-051): enough to see a run of calls, short enough to stay small. */
export const ACTIONS_SHOWN = 5;

/** An action's time: hours and minutes, in the user's own format. */
export const ACTION_TIME = { hour: "2-digit", minute: "2-digit" } as const;

/** The busy state of D-06 as one status sentence (A§15.10). */
export const BUSY_TEXT = { line: (op: string, seconds: number) => `Busy: ${op} since ${seconds} s` } as const;

/** The busy sentence counts whole seconds, so it is drawn again once a second. */
export const MS_PER_SECOND = 1000;

/** The support and feedback lines around their links (P-052). */
export const SUPPORT_TEXT = {
  support: "Pixelwright is free. Support it on ",
  or: " or ",
  feedback: "Ideas or a bug? Tell us on ",
  end: ".",
} as const;

export const WINDOW_ERROR = { missing: (id: string) => `ui.html has no element #${id}` } as const;

/** Anything but a digit, which the code field drops from what was typed or pasted. */
export const NOT_A_DIGIT = /\D/g;
