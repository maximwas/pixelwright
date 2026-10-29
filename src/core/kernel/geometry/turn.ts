import { GEOMETRY } from "@/core/kernel/geometry/geometry.constants.ts";

/**
 * A layer's turn as Figma keeps it (K-068): its rotation, and for a mirrored layer the 2x2 matrix [a, b, c, d]. Figma
 * reports a horizontal flip as a -180 degree rotation, so only the matrix tells a flip from a turn.
 */
export class Turn {
  readonly #rotation: number;
  readonly #mirror: readonly number[] | undefined;

  constructor(rotation: number | undefined, mirror: readonly number[] | undefined) {
    this.#rotation = rotation ?? 0;
    this.#mirror = mirror;
  }

  /**
   * Degrees counter-clockwise, as Figma turns. A mirrored layer is its matrix times a horizontal flip: the angle left
   * once the flip is taken out, atan2(b, -a).
   */
  degrees(): number {
    if (this.#mirror === undefined) {
      return this.#rotation;
    }

    const [m00 = -1, m01 = 0] = this.#mirror;

    return (Math.atan2(m01, -m00) * GEOMETRY.halfTurnDegrees) / Math.PI;
  }

  mirrored(): boolean {
    return this.#mirror !== undefined;
  }
}
