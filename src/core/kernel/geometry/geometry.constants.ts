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
  /** A sine or cosine this close to 0 is 0, so a turn of 90 degrees lands on whole values. */
  snap: 1e-10,
  /** Figma's float noise in a transform: a matrix this close to the live one is not written again. */
  noise: 1e-6,
  /** The smallest size Figma resizes a layer to: 0 throws. */
  minSize: 0.01,
} as const;

/** A parent's axes, as a placement names them. */
export const MATRIX_AXIS = { horizontal: "horizontal", vertical: "vertical" } as const;

/** How a line lies: along the x axis, or along the y axis. */
export const LINE_AXIS = { flat: "flat", standing: "standing" } as const;
