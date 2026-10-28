/** A window's random id: 12 bytes, as 0.7.0's; it only has to differ from other windows' (S-011). */
export const INSTANCE_ID_BYTES = 12;

export const WINDOW_LINK_ERROR = {
  noContext: "the link asked for the plugin info before main sent the file's context",
} as const;
