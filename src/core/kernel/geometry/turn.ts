import { GEOMETRY, LINE_AXIS } from "@/core/kernel/geometry/geometry.constants.ts";

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

  /** How a line at this turn lies: flat or standing within half a degree, else null (a turned line). */
  lineAxis(): (typeof LINE_AXIS)[keyof typeof LINE_AXIS] | null {
    const half = GEOMETRY.halfTurnDegrees;
    const angle = ((this.degrees() % half) + half) % half;

    if (Math.abs(angle - GEOMETRY.rightAngleDegrees) <= GEOMETRY.lineSnapDegrees) {
      return LINE_AXIS.standing;
    }

    return angle <= GEOMETRY.lineSnapDegrees || angle >= half - GEOMETRY.lineSnapDegrees ? LINE_AXIS.flat : null;
  }

  mirrored(): boolean {
    return this.#mirror !== undefined;
  }
}
