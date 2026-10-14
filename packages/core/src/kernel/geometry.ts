/** A layer's transform as Figma holds it: [[a, b, x], [c, d, y]], the layer's own axes and its place in its parent. */
export type Matrix = [[number, number, number], [number, number, number]];

/** A layer's own width and height, unturned. */
export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

export type Axis = "horizontal" | "vertical";

/** A sine or cosine within 1e-10 of zero is zero: a turn of 90 degrees lands on whole values. */
export function snapped(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

/** Whether a matrix differs from the live one past Figma's float noise (1e-6 in any entry). */
export function differs(next: Matrix, live: readonly (readonly number[])[]): boolean {
  const current = live.flat();

  return next.flat().some((value, index) => Math.abs(value - (current[index] ?? 0)) > 1e-6);
}

/**
 * The matrix of a layer turned and mirrored about its centre, as CSS turns. Figma's matrix for a turn of r degrees is
 * [[cos r, sin r], [-sin r, cos r]]; a mirror flips the layer's own x first (design_read reads it back the same way).
 */
export function turnedAbout(matrix: Matrix, size: BoxSize, rotation: number, mirror: boolean): Matrix {
  const [[a0, b0, x0], [c0, d0, y0]] = matrix;
  const half = [size.width / 2, size.height / 2] as const;
  const centre = [a0 * half[0] + b0 * half[1] + x0, c0 * half[0] + d0 * half[1] + y0] as const;
  const turn = (rotation * Math.PI) / 180;
  const cos = snapped(Math.cos(turn));
  const sin = snapped(Math.sin(turn));
  const [a, b, c, d] = mirror ? [-cos, sin, sin, cos] : [cos, sin, -sin, cos];

  return [
    [a, b, centre[0] - (a * half[0] + b * half[1])],
    [c, d, centre[1] - (c * half[0] + d * half[1])],
  ];
}

/** The matrix with the layer's centre moved to `centre` along one axis; the other axis stays. */
export function centredAlong(matrix: Matrix, size: BoxSize, axis: Axis, centre: number): Matrix {
  const [[a, b, x], [c, d, y]] = matrix;
  const half = [size.width / 2, size.height / 2] as const;

  return axis === "horizontal"
    ? [
        [a, b, centre - (a * half[0] + b * half[1])],
        [c, d, y],
      ]
    : [
        [a, b, x],
        [c, d, centre - (c * half[0] + d * half[1])],
      ];
}

/** How long a turned box is along one axis of its parent. */
export function coveredLength(matrix: Matrix, size: BoxSize, axis: Axis): number {
  const [[a0, b0], [c0, d0]] = matrix;

  return axis === "horizontal"
    ? Math.abs(a0) * size.width + Math.abs(b0) * size.height
    : Math.abs(c0) * size.width + Math.abs(d0) * size.height;
}
