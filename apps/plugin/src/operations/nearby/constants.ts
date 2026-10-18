/** A frame or a group with more layers than this is a design of its own, not a note. */
export const NOTE_LAYERS_MAX = 20;

/** A note's text past this many characters is cut, with an ellipsis. */
export const NOTE_TEXT_MAX = 2_000;

/** How long the canvas around a screen is walked, at most. */
export const NEARBY_TIME_MS = 5_000;

/** Names a component or an instance carries when it is a note: a sticky, a comment, a spec, a callout. */
export const NOTE_NAMES =
  /\b(?:notes?|sticky|stickies|comments?|annotations?|to-?dos?|specs?|callouts?|descriptions?|readme)\b/i;
