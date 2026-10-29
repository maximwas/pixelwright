import { inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { LAYER_READ } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Box = NonNullable<ReadLayer["bounds"]>;

/**
 * A layer's box past its header (0.7.0's geometry): its rotation, a mirroring matrix, the box a turned or mirrored
 * layer covers, and the box it draws in when that reaches past its own (centred or outside strokes, shadows).
 */
@injectable()
export class BoxFieldReader implements FieldReader {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  read(node: SceneNode, origin: Vector): Partial<ReadLayer> {
    const rotation = "rotation" in node && node.rotation !== 0 ? node.rotation : undefined;
    const mirror = this.#mirror(node.relativeTransform);
    const own = node.absoluteBoundingBox;
    const drawn = "absoluteRenderBounds" in node ? node.absoluteRenderBounds : null;
    const turned = rotation !== undefined || mirror !== undefined;

    return {
      ...(turned && own !== null ? { bounds: this.#box(own, origin) } : {}),
      ...(drawn !== null && own !== null && this.#reachesPast(drawn, own)
        ? { renderBounds: this.#box(drawn, origin) }
        : {}),
      ...(rotation === undefined ? {} : { rotation }),
      ...(mirror === undefined ? {} : { mirrorTransform: mirror }),
    };
  }

  /** A mirrored layer's 2x2 transform (negative determinant): Figma reports a flip as a -180° rotation. */
  #mirror([[m00, m01], [m10, m11]]: Transform): number[] | undefined {
    return m00 * m11 - m01 * m10 < 0
      ? [m00, m01, m10, m11].map((value) => this.#format.round(value, PRECISION.matrix))
      : undefined;
  }

  #box(rect: Rect, origin: Vector): Box {
    return {
      x: this.#round(rect.x - origin.x),
      y: this.#round(rect.y - origin.y),
      width: this.#round(rect.width),
      height: this.#round(rect.height),
    };
  }

  /** Whether the layer draws more than half a pixel past its own box on any side. */
  #reachesPast(drawn: Rect, own: Rect): boolean {
    return (
      this.#past(drawn.x, own.x) ||
      this.#past(drawn.y, own.y) ||
      this.#past(drawn.width, own.width) ||
      this.#past(drawn.height, own.height)
    );
  }

  #past(drawn: number, own: number): boolean {
    return Math.abs(drawn - own) > LAYER_READ.drawnPastPx;
  }

  #round(value: number): number {
    return this.#format.round(value, PRECISION.layer);
  }
}
