/** The read-only attribute each trigger is written as; another trigger is `$on-<its words>`. */
export const TRIGGER_ATTRIBUTES: Readonly<Record<string, string>> = {
  ON_CLICK: "$on-click",
  ON_HOVER: "$on-hover",
  ON_PRESS: "$on-press",
  ON_DRAG: "$on-drag",
  MOUSE_ENTER: "$on-mouse-enter",
  MOUSE_LEAVE: "$on-mouse-leave",
  MOUSE_DOWN: "$on-mouse-down",
  MOUSE_UP: "$on-mouse-up",
  ON_KEY_DOWN: "$on-key",
  AFTER_TIMEOUT: "$after-timeout",
  ON_MEDIA_HIT: "$on-media-hit",
  ON_MEDIA_END: "$on-media-end",
};

/** What a NODE action does with its destination; another navigation is its own words. */
export const NAVIGATIONS: Readonly<Record<string, string>> = {
  NAVIGATE: "go to",
  CHANGE_TO: "change to",
  OVERLAY: "open overlay",
  SWAP: "swap overlay to",
  SCROLL_TO: "scroll to",
};

/** The actions without a destination, in words; another is its own words. */
export const SIMPLE_ACTIONS: Readonly<Record<string, string>> = {
  BACK: "back",
  CLOSE: "close overlay",
  SET_VARIABLE: "set a variable",
  SET_VARIABLE_MODE: "set a variable mode",
  CONDITIONAL: "if / else",
  UPDATE_MEDIA_RUNTIME: "control the media",
};

export const ACTION_TYPE = { node: "NODE", url: "URL" } as const;

/** An interaction as a sentence: `after 500ms; change to Type=Hover; smart animate 300ms ease-out`. */
export const INTERACTION_TEXT = {
  /** A NODE action without a navigation goes to its destination. */
  navigate: "NAVIGATE",
  nothing: "nothing",
  instant: "instant",
  link: "a link",
  open: (url: string) => `open ${url}`,
  after: (ms: string) => `after ${ms}`,
  ms: (ms: number) => `${ms}ms`,
  goes: (what: string, where: string) => `${what} ${where}`,
  /** Between the parts of one interaction, and between a trigger's interactions. */
  step: "; ",
  joiner: " | ",
  space: " ",
  dash: "-",
  underscore: /_/g,
  onPrefix: /^ON_/,
  trigger: (words: string) => `$on-${words}`,
  /** Figma gives durations and waits in seconds; the sentence says ms. */
  msPerSecond: 1000,
} as const;
