import { InjectionToken, inject, injectable } from "@needle-di/core";
import { INSPECT_TEXT, MEASURED_SIDE } from "@/core/inspect/inspect.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A Dev Mode measurement as design_read's JSON gives it: its ends, the px between them, the designer's text. */
export interface MeasurementView {
  readonly from: string;
  readonly to: string;
  readonly px?: number;
  readonly text?: string;
}

/**
 * The designer's Dev Mode measurements in a read (T-061): each end as "<id> <side>", and the distance between the two
 * sides from the read's boxes (a rotated layer's bounding box) when both layers are in it.
 */
@injectable()
export class Measurements {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  read(model: ReadModel): MeasurementView[] {
    const boxes = new Map<string, ReadLayer>();
    const walk = (layer: ReadLayer): void => {
      boxes.set(layer.id, layer);
      layer.children?.forEach(walk);
    };

    walk(model.root);

    return (model.measurements ?? []).map(({ start, end, text }) => {
      const from = this.#side(boxes.get(start.id), start.side);
      const to = this.#side(boxes.get(end.id), end.side);

      return {
        from: INSPECT_TEXT.end(start.id, start.side),
        to: INSPECT_TEXT.end(end.id, end.side),
        ...(from === null || to === null ? {} : { px: this.#format.round(Math.abs(to - from), PRECISION.distance) }),
        ...(text === undefined ? {} : { text }),
      };
    });
  }

  /** Where a layer's side is in the read's frame: x for left and right, y for top and bottom. */
  #side(layer: ReadLayer | undefined, side: string): number | null {
    if (layer === undefined) {
      return null;
    }

    const { x, y, width, height } = layer.bounds ?? layer;
    const sides: Readonly<Record<string, number>> = {
      [MEASURED_SIDE.left]: x,
      [MEASURED_SIDE.right]: x + width,
      [MEASURED_SIDE.top]: y,
      [MEASURED_SIDE.bottom]: y + height,
    };

    return sides[side] ?? null;
  }
}

export const MEASUREMENTS = new InjectionToken<Measurements>("Measurements");
