/** What a change does to its layer: makes one, or writes to the one its id names. */
export const APPLY_CHANGE_KIND = { create: "create", update: "update" } as const;

/** The component properties prop, visibleProp and swapProp make, as Figma types them. */
export const APPLY_PROPERTY_TYPE = { text: "TEXT", boolean: "BOOLEAN", swap: "INSTANCE_SWAP" } as const;

export const APPLY = {
  /** Why 10,000: 0.7.0's cap, more elements than 2,000,000 characters of XML hold. */
  maxChanges: 10_000,
  /** Why 50: longer than the longest tag design_read writes. */
  tagChars: 50,
  /** Why 1,000,000: a text's characters, half of what one call's XML may hold. */
  characters: 1_000_000,
} as const;
