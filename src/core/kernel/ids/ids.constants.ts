/** Figma's layer id parts (C-167, T-170): an instance's layers start with I. */
export const LAYER_ID_PART = { instance: "I" } as const;

export const LAYER_ID_TEXT = {
  /** How every id under a layer starts once Figma re-ids them there (`<slot id>;<id>`). */
  under: (id: string) => `${id};`,
} as const;
