import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PAINTS_TEXT, PAINTS_VALUE, UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import { type Paint, SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer's paints as CSS: one value top first, the table's note marker, or nothing painted. */
export type PaintCss = string | typeof UNMAPPED_PAINT | null;

/**
 * A layer's paints as one CSS value, top layer first (C-080): `var(--Style)` for a paint style, else each visible
 * paint's own CSS. A layer the table cannot write makes the whole list unmapped: half a background would mislead.
 */
@injectable()
export class PaintList {
  readonly #solid;

  constructor(solid = inject(SOLID_PAINT)) {
    this.#solid = solid;
  }

  css(
    paints: readonly Paint[],
    styleId: string | undefined,
    model: ReadModel,
  ): PaintCss {
    const style = styleId === undefined ? undefined : model.styles[styleId];

    if (style?.paints !== undefined) {
      return PAINTS_TEXT.token(this.#solid.token(style.name));
    }

    const layers = [...paints]
      .filter((paint) => paint.visible ?? true)
      .reverse()
      .map((paint) => this.#solid.css(paint, model));

    if (layers.length === 0) {
      return null;
    }

    if (layers.some((layer) => layer === null)) {
      return UNMAPPED_PAINT;
    }

    // Only the bottom layer of a CSS background may be a plain colour: one above it becomes a flat gradient.
    return layers
      .map((layer, index) => (index < layers.length - 1 ? PAINTS_TEXT.flat(layer ?? PAINTS_VALUE.none) : layer))
      .join(PAINTS_VALUE.layerJoint);
  }
}

export const PAINT_LIST = new InjectionToken<PaintList>("PaintList");
