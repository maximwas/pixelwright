/** A gradient's kind as the parser gives it; Figma's paint type is `GRADIENT_` and the kind. */
export const GRADIENT_KIND = { linear: "LINEAR", radial: "RADIAL", angular: "ANGULAR" } as const;

/** Figma's gradient paint types and the kind each is; a diamond has no CSS. */
export const FIGMA_GRADIENT: Readonly<Record<string, (typeof GRADIENT_KIND)[keyof typeof GRADIENT_KIND]>> = {
  GRADIENT_LINEAR: GRADIENT_KIND.linear,
  GRADIENT_RADIAL: GRADIENT_KIND.radial,
  GRADIENT_ANGULAR: GRADIENT_KIND.angular,
};

/** The units a centre or a radius is kept in. */
export const GRADIENT_UNIT = { px: "px", percent: "%" } as const;

export const GRADIENT_NUMBER = {
  degreesPerRadian: 180 / Math.PI,
  fullTurn: 360,
  half: 0.5,
  percent: 100,
  /** A radial transform's cross terms below this are float noise, not a turn (0.7.0). */
  straight: 1e-6,
  /** A transform whose determinant is below this is flat: it has no inverse. */
  flat: 1e-9,
  /** CSS's direction when a linear gradient names none: to bottom. */
  defaultLinear: 180,
  /** A gradient needs two stops. */
  minStops: 2,
} as const;

/** CSS's `to <side>` directions as angles; a corner as its diagonal on a square (0.7.0). */
export const GRADIENT_SIDES: Readonly<Record<string, number>> = {
  "to top": 0,
  "to top right": 45,
  "to right top": 45,
  "to right": 90,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom": 180,
  "to bottom left": 225,
  "to left bottom": 225,
  "to left": 270,
  "to top left": 315,
  "to left top": 315,
};

/** A centre CSS leaves out: the box's middle. */
export const GRADIENT_CENTRE = {
  x: { value: 50, unit: GRADIENT_UNIT.percent },
  y: { value: 50, unit: GRADIENT_UNIT.percent },
} as const;

/** Position keywords as percents of the box. */
export const GRADIENT_PLACES: Readonly<Record<string, number>> = {
  left: 0,
  top: 0,
  center: 50,
  right: 100,
  bottom: 100,
};

/** Degrees per unit of a CSS angle. */
export const ANGLE_UNITS: Readonly<Record<string, number>> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

export const GRADIENT_PATTERN = {
  gradient: /^(linear|radial|conic)-gradient\(([\s\S]*)\)$/,
  at: /\bat\b/,
  from: /\bfrom\s+(\S+)/,
  place: /\bat\s+(.+)$/,
  spaces: /\s+/,
  /** `color-mix(in <space>, <colour> N%, transparent)`, as design_read writes a faded token. */
  mix: /^color-mix\(\s*in\s+[\w-]+\s*,\s*(.+?)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/s,
} as const;

export const GRADIENT_VALUE = {
  linear: "linear",
  radial: "radial",
  ellipse: "ellipse",
  circle: "circle",
  center: "center",
  space: " ",
  joint: ", ",
} as const;

export const GRADIENT_TEXT = {
  stop: (color: string, place: number) => `${color} ${place}%`,
  linear: (angle: number, stops: string) => `linear-gradient(${angle}deg, ${stops})`,
  radial: (shape: string, stops: string) => `radial-gradient(${shape}, ${stops})`,
  ellipse: (
    radii: string,
    x: number,
    y: number,
  ) => `${radii} at ${x}% ${y}%`,
  conic: (
    angle: number,
    centre: readonly [number, number],
    stops: string,
  ) =>
    `conic-gradient(from ${angle}deg at ${centre[0]}% ${centre[1]}%, ${stops})`,
} as const;
