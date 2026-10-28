/**
 * The two virtual channels on figma.ui (A§4.3): the server's frames, which the window relays to and from its socket
 * unread, and the window's own messages to the plugin's main thread.
 */
export const UI_CHANNEL_NAME = {
  server: "server",
  window: "window",
} as const;

/** The field that names a figma.ui message's channel. */
export const UI_CHANNEL_FIELD = "ch";

/** The field that names a window message's kind. */
export const WINDOW_MESSAGE_FIELD = "type";

/**
 * What the window and main say to each other: the window is ready, main hands it the stored key and the file's context
 * (never through showUI, FX-001), the window hands back a key a pairing issued and the Allow edits switch.
 */
export const WINDOW_MESSAGE = {
  ready: "ready",
  start: "start",
  savePairing: "save_pairing",
  allowEdits: "allow_edits",
  visible: "visible",
} as const;

/**
 * The frame the window relays to main when a socket's session starts, before the server sends anything: main opens its
 * RPC peer for that epoch at once, so plugin info events reach the new socket (S-012). It is not an RPC frame.
 */
export const LINK_OPENED_FRAME = "";
