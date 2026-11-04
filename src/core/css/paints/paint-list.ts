import { InjectionToken, inject, injectable } from "@needle-di/core";
import { GRADIENT_CSS } from "@/core/css/gradients/gradient-css.ts";
import type { Box } from "@/core/css/gradients/gradients.types.ts";
import { IMAGE_PAINT } from "@/core/css/paints/image-paint.ts";
import { FIGMA_PAINT, PAINTS_TEXT, PAINTS_VALUE, UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import { type Paint, SOLID_PAINT } from "@/core/css/paints/solid-paint.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import type { ModelTables } from "@/shared/read-model/read-model.schema.ts";

/** A layer's paints as CSS: one value top first, the table's note marker, or nothing painted. */
export type PaintCss = string | typeof UNMAPPED_PAINT | null;

/**
 * A layer's paints as one CSS value, top layer first (C-080): `var(--Style)` for a paint style, else each visible
 * paint's own CSS. A layer the table cannot write makes the whole list unmapped: half a background would mislead.
 */
@injectable()
export class PaintList {
  readonly #solid;
  readonly #gradient;
  readonly #image;
  readonly #names;

  constructor(
    solid = inject(SOLID_PAINT),
    gradient = inject(GRADIENT_CSS),
    image = inject(IMAGE_PAINT),
    names = inject(TOKEN_NAMES),
  ) {
    this.#solid = solid;
    this.#gradient = gradient;
    this.#image = image;
    this.#names = names;
  }

  /** The list's CSS; gradients and images only on a box (a background): a border or a text's colour takes colours. */
  css(
    paints: readonly Paint[],
    styleId: string | undefined,
    model: ModelTables,
    box: Box | null = null,
  ): PaintCss {
    const style = styleId === undefined ? undefined : model.styles[styleId];

    if (style?.paints !== undefined) {
      return PAINTS_TEXT.token(this.#names.style(style));
    }

    const visible = [...paints].filter((paint) => paint.visible ?? true).reverse();
    const layers = visible.map((paint) => this.#layer(paint, model, box));

    if (layers.length === 0) {
      return null;
    }

    if (layers.some((layer) => layer === null)) {
      return UNMAPPED_PAINT;
    }

    // Only the bottom layer of a CSS background may be a plain colour: a solid above it becomes a flat gradient.
    return layers
      .map((layer, index) =>
        index < layers.length - 1 && visible[index]?.type === FIGMA_PAINT.solid
          ? PAINTS_TEXT.flat(layer ?? PAINTS_VALUE.none)
          : layer,
      )
      .join(PAINTS_VALUE.layerJoint);
  }

  #layer(
    paint: Paint,
    model: ModelTables,
    box: Box | null,
  ): string | null {
    if (box === null || paint.type === FIGMA_PAINT.solid) {
      return this.#solid.css(paint, model);
    }

    return paint.type === FIGMA_PAINT.image ? this.#image.css(paint) : this.#gradient.css(paint, box, model);
  }
}

export const PAINT_LIST = new InjectionToken<PaintList>("PaintList");
