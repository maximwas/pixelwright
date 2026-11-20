import { GEOMETRY, MATRIX_AXIS } from "@/core/kernel/geometry/geometry.constants.ts";

/** A layer's transform as Figma holds it: [[a, b, x], [c, d, y]], its own axes and its place in its parent. */
export type Matrix = [[number, number, number], [number, number, number]];

/** A layer's own width and height, unturned. */
export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

export type MatrixAxis = (typeof MATRIX_AXIS)[keyof typeof MATRIX_AXIS];

/**
 * A layer's transform and size (P-151): the matrices that turn it about its centre and move its centre, as 0.7.0's
 * geometry computed them. Own code: transformation-matrix 3.1.0 was last published 2025-08-18.
 */
export class LayerMatrix {
  readonly #matrix: Matrix;
  readonly #size: BoxSize;

  constructor(matrix: Matrix, size: BoxSize) {
    this.#matrix = matrix;
    this.#size = size;
  }

  /**
   * Turned and mirrored about its centre, as CSS turns. Figma's matrix for a turn of r degrees is
   * [[cos r, sin r], [-sin r, cos r]]; a mirror flips the layer's own x first (design_read reads it back the same way).
   */
  turned(rotation: number, mirror: boolean): Matrix {
    const [[m00, m01, x0], [m10, m11, y0]] = this.#matrix;
    const [halfWidth, halfHeight] = this.#halves();
    const centreX = m00 * halfWidth + m01 * halfHeight + x0;
    const centreY = m10 * halfWidth + m11 * halfHeight + y0;
    const turn = (rotation * Math.PI) / GEOMETRY.halfTurnDegrees;
    const cos = this.#snapped(Math.cos(turn));
    const sin = this.#snapped(Math.sin(turn));
    const [n00, n01, n10, n11] = mirror ? [-cos, sin, sin, cos] : [cos, sin, -sin, cos];

    return [
      [n00, n01, centreX - (n00 * halfWidth + n01 * halfHeight)],
      [n10, n11, centreY - (n10 * halfWidth + n11 * halfHeight)],
    ];
  }

  /** The centre moved to `centre` along one axis of the parent; the other axis stays. */
  centredAlong(axis: MatrixAxis, centre: number): Matrix {
    const [[m00, m01, x], [m10, m11, y]] = this.#matrix;
    const [halfWidth, halfHeight] = this.#halves();

    return axis === MATRIX_AXIS.horizontal
      ? [
        [m00, m01, centre - (m00 * halfWidth + m01 * halfHeight)],
        [m10, m11, y],
      ]
      : [
        [m00, m01, x],
        [m10, m11, centre - (m10 * halfWidth + m11 * halfHeight)],
      ];
  }

  /** How long the turned box is along one axis of its parent. */
  covered(axis: MatrixAxis): number {
    const [[m00, m01], [m10, m11]] = this.#matrix;
    const { width, height } = this.#size;

    return axis === MATRIX_AXIS.horizontal
      ? Math.abs(m00) * width + Math.abs(m01) * height
      : Math.abs(m10) * width + Math.abs(m11) * height;
  }

  /** Whether `next` differs from this matrix past Figma's float noise. */
  differs(next: Matrix): boolean {
    const current = this.#matrix.flat();

    return next.flat().some((value, index) => Math.abs(value - (current[index] ?? 0)) > GEOMETRY.noise);
  }

  #halves(): [number, number] {
    return [this.#size.width / GEOMETRY.halves, this.#size.height / GEOMETRY.halves];
  }

  #snapped(value: number): number {
    return Math.abs(value) < GEOMETRY.snap ? 0 : value;
  }
}
