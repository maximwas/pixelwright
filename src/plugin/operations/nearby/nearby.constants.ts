/** What the plugin takes for a note around a screen (T-058), as 0.7.0 did. */
export const NOTE = {
  /** A frame or a group with more layers than this is a design of its own, not a note. */
  layersMax: 20,
  /** A note's text past this many characters is cut, with an ellipsis. */
  textMax: 2_000,
  /** How long the canvas around a screen is walked, at most, in ms. */
  timeMs: 5_000,
  /** Names a component or an instance carries when it is a note: a sticky, a comment, a spec, a callout. */
  names: /\b(?:notes?|sticky|stickies|comments?|annotations?|to-?dos?|specs?|callouts?|descriptions?|readme)\b/i,
  /** Layers that hold a note's texts: frames and groups, and components and instances named like a note. */
  holders: ["FRAME", "GROUP"] as readonly string[],
  namedHolders: ["INSTANCE", "COMPONENT", "COMPONENT_SET"] as readonly string[],
  /** What a frame or group not named like a note may hold and still be one: texts and the plain shapes around them. */
  parts: ["TEXT", "FRAME", "GROUP", "RECTANGLE", "ELLIPSE", "LINE"] as readonly string[],
  /** Fills that make a holder a design: a picture. */
  pictures: ["IMAGE", "VIDEO"] as readonly string[],
  section: "SECTION",
  text: "TEXT",
  lines: "\n",
  ellipsis: "…",
} as const;

export const NEARBY_TEXT = {
  page: (id: string) => `${id} is a page: read the notes around a layer on it.`,
  noBox: (name: string) => `${name} has no box on the canvas.`,
} as const;
