import { injectable } from "@needle-di/core";
import { GEOMETRY } from "@/core/kernel/geometry/geometry.constants.ts";
import { INTENT_AXIS } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

export type AxisPlacement = NonNullable<FigmaProps["horizontal"]>;

/** The parent's length on the axis and the layer's own, in px. */
interface Lengths {
  readonly parent: number;
  readonly own: number;
}

/** Where a layer starts on one axis of its parent and how long it is there, in px. */
interface Span {
  readonly start: number;
  readonly size: number;
}

/**
 * A placed layer's span on its live parent from its placement (C-053): what design_apply's edges asked, given the
 * parent's length and the layer's own. The one copy: 0.7.0 kept it in core and again in the plugin.
 */
@injectable()
export class PlacementSpan {
  on(placement: AxisPlacement, { parent: parentLength, own: length }: Lengths): Span {
    const { kind, offset = 0, start = 0, end = 0, size = 0 } = placement;

    if (kind === INTENT_AXIS.STRETCH) {
      return { start, size: parentLength - start - end };
    }

    if (kind === INTENT_AXIS.SCALE) {
      return { start: (parentLength * start) / GEOMETRY.percent, size: (parentLength * size) / GEOMETRY.percent };
    }

    const from = {
      [INTENT_AXIS.MIN]: offset,
      [INTENT_AXIS.MAX]: parentLength - offset - length,
      [INTENT_AXIS.CENTER]: parentLength / GEOMETRY.halves + offset,
    }[kind];

    return { start: from, size: length };
  }
}
