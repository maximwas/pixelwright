/** Figma's named curves as cubic Béziers (K-066). */
export const NAMED_CURVES: Readonly<Record<string, readonly number[]>> = {
  LINEAR: [0, 0, 1, 1],
  EASE_IN: [0.42, 0, 1, 1],
  EASE_OUT: [0, 0, 0.58, 1],
  EASE_IN_AND_OUT: [0.42, 0, 0.58, 1],
  EASE_IN_BACK: [0.36, 0, 0.66, -0.56],
  EASE_OUT_BACK: [0.34, 1.56, 0.64, 1],
  EASE_IN_AND_OUT_BACK: [0.68, -0.6, 0.32, 1.6],
};

/** The cubic Béziers CSS has a keyword for, by their numbers as EasingCss joins them. */
export const CSS_EASING_KEYWORDS: Readonly<Record<string, string>> = {
  "0, 0, 1, 1": "linear",
  "0.42, 0, 1, 1": "ease-in",
  "0, 0, 0.58, 1": "ease-out",
  "0.42, 0, 0.58, 1": "ease-in-out",
  "0.25, 0.1, 0.25, 1": "ease",
};

/**
 * How an easing is written. Springs (Gentle, Quick, Bouncy, Slow, a custom one) have no CSS here: Figma publishes no
 * numbers for its presets (D-24: the community values are unverified, FX-064), and drawing a spring as linear() is the
 * Motion item's; a sentence names a spring by its Figma type.
 */
export const EASING = {
  hold: "HOLD",
  stepEnd: "step-end",
  separator: ", ",
  /** A Bézier's control points: x1, y1, x2, y2. */
  points: 4,
  cubicBezier: (numbers: string) => `cubic-bezier(${numbers})`,
} as const;
