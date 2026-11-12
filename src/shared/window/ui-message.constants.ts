/**
 * The two virtual channels on figma.ui (A§4.3): the server's frames, which the window relays to and from its socket
 * unread, and the window's own messages to the plugin's main thread.
 */
export const UI_CHANNEL_NAME = { server: "server", window: "window" } as const;

/** The field that names a figma.ui message's channel. */
export const UI_CHANNEL_FIELD = "ch";

/** The field that names a window message's kind. */
export const WINDOW_MESSAGE_FIELD = "type";

/**
 * What the window and main say to each other: the window is ready, main hands it the stored key and the file's context
 * (never through showUI, FX-001), the window hands back a key a pairing issued and the Allow edits switch. Main tells
 * the window what each op did and what still runs past its answer; the window asks main to open a link and to fit its
 * height. Each is one event, never answered.
 */
export const WINDOW_MESSAGE = {
  ready: "ready",
  start: "start",
  savePairing: "save_pairing",
  allowEdits: "allow_edits",
  visible: "visible",
  activity: "activity",
  busy: "busy",
  openLink: "open_link",
  resize: "resize",
} as const;

/** How an op the window lists ended (P-051): done, failed (a warning), or refused while Allow edits was off (P-012). */
export const ACTIVITY_OUTCOME = { done: "done", failed: "failed", refused: "refused" } as const;

/**
 * Where the window sends people (P-052, K-102): a one-time donation, Ko-fi first (cards and PayPal, for supporters
 * abroad), then a monobank jar (GitHub Sponsors does not pay out in Ukraine); and the repository's discussions for
 * ideas and bugs. Main opens these addresses and no other.
 */
export const SUPPORT_LINKS = [
  { label: "Ko-fi", url: "https://ko-fi.com/maksymvasianin" },
  { label: "monobank", url: "https://send.monobank.ua/jar/7o9oMrbXTj" },
] as const;

export const FEEDBACK_LINK = { label: "GitHub", url: "https://github.com/maximwas/pixelwright/discussions" } as const;

/**
 * The frame the window relays to main when a socket's session starts, before the server sends anything: main opens its
 * RPC peer for that epoch at once, so plugin info events reach the new socket (S-012). It is not an RPC frame.
 */
export const LINK_OPENED_FRAME = "";
