export const GEOMETRY = {
  /** Degrees in half a turn: radians times this over pi. */
  halfTurnDegrees: 180,
  /** A box's centre lies half its length from its start. */
  halves: 2,
  /** A line within half a degree of lying flat or standing is drawn as such (0.7.0's snap). */
  lineSnapDegrees: 0.5,
  rightAngleDegrees: 90,
  /** A scaled layer's start and size are percents of its parent. */
  percent: 100,
} as const;

/** How a line lies: along the x axis, or along the y axis. */
export const LINE_AXIS = { flat: "flat", standing: "standing" } as const;
