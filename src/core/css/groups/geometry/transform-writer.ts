import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { ANGLE_UNITS } from "@/core/css/gradients/gradients.constants.ts";
import {
  GEOMETRY_ERROR,
  TRANSFORM_ATTRIBUTES,
  TRANSFORM_WRITE,
} from "@/core/css/groups/geometry/geometry.constants.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";

/**
 * A layer's turn written back whole (C-052): rotate() and scaleX(-1), all Figma keeps, so a turn without scaleX(-1)
 * also takes a mirror away and none takes both.
 */
@injectable()
export class TransformWriter implements PropertyWriter {
  readonly attributes = TRANSFORM_ATTRIBUTES;
  readonly #split;
  readonly #format;

  constructor(split = inject(CSS_SPLIT), format = inject(NUMBER_FORMAT)) {
    this.#split = split;
    this.#format = format;
  }

  write({ own }: WriteInput, out: WriteOutput): void {
    const value = (own(CSS_PROPERTY.transform) ?? "").trim();
    let rotation = 0;
    let mirror = false;

    for (const part of value === TRANSFORM_WRITE.none ? [] : this.#split.split(value, CSS_SEPARATOR.space)) {
      const turn = TRANSFORM_WRITE.rotate.exec(part);

      if (turn !== null) {
        // CSS turns clockwise, Figma counter-clockwise.
        const degrees = Number(turn[1]) * (ANGLE_UNITS[(turn[2] ?? "").toLowerCase()] ?? 1);

        rotation = this.#format.round(-degrees, PRECISION.written);
      } else if (part === TRANSFORM_WRITE.mirror) {
        mirror = true;
      } else {
        out.fail(CSS_PROPERTY.transform, GEOMETRY_ERROR.badTransform(part));

        return;
      }
    }

    out.set(INTENT_KEY.rotation, rotation, CSS_PROPERTY.transform);
    out.set(INTENT_KEY.mirror, mirror, CSS_PROPERTY.transform);
  }
}
