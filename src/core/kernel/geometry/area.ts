import { GEOMETRY } from "@/core/kernel/geometry/geometry.constants.ts";

/** A point in px. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A box in px: where it starts and how big it is (a layer, its bounds, a Figma rect). */
interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

/** A box as a value (K-068). */
export class Area {
  readonly #box: Box;

  constructor(box: Box) {
    this.#box = box;
  }

  /**
   * The box's centre. Figma's bounds of a turned layer bound the turned layer, and a turned rectangle's bounds share
   * its centre, so this is a turned layer's centre too.
   */
  centre(): Point {
    const { x, y, width, height } = this.#box;

    return { x: x + width / GEOMETRY.halves, y: y + height / GEOMETRY.halves };
  }
}
