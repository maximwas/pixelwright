import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  FIGMA_PAINT_GROUP,
  PAINT_NOTE,
  PAINT_NUMBER,
  PAINT_TEXT,
  PAINT_VALUE,
  SIDE_WEIGHTS,
  STROKES_ATTRIBUTES,
  STROKES_SOURCES,
  TEXT_TYPES,
  UNMAPPED_NOTE,
  VECTOR_TYPES,
} from "@/core/css/groups/paint/paint.constants.ts";
import { PAINT_LIST, type PaintCss } from "@/core/css/paints/paint-list.ts";
import { UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { LINE_AXIS } from "@/core/kernel/geometry/geometry.constants.ts";
import { Turn } from "@/core/kernel/geometry/turn.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * A layer's strokes (C-090): an inside or centred stroke is a border (with box-sizing: border-box it keeps the size),
 * an outside one an outline; per-side weights are a border per side. A line is one border: across its top when it
 * lies flat or turned, down its left when it stands (the geometry group sizes it). Texts and vectors draw their own.
 */
@injectable()
export class StrokesGroup implements PropertyGroup {
  readonly attributes = STROKES_ATTRIBUTES;
  readonly sources = STROKES_SOURCES;
  readonly #paints;
  readonly #format;

  constructor(paints = inject(PAINT_LIST), format = inject(NUMBER_FORMAT)) {
    this.#paints = paints;
    this.#format = format;
  }

  read({ layer, model, css }: CssScope): void {
    if ((TEXT_TYPES[layer.type] ?? false) || (VECTOR_TYPES[layer.type] ?? false)) {
      return;
    }

    const color = this.#paints.css(layer.strokes ?? [], layer.strokeStyleId, model);

    if (layer.type === FIGMA_PAINT_GROUP.line) {
      this.#line(layer, color, css);
    } else if (color === UNMAPPED_PAINT) {
      css.note(CSS_PROPERTY.border, UNMAPPED_NOTE[CSS_PROPERTY.border]);
    } else if (color !== null) {
      this.#box(layer, color, css);
    }
  }

  #box(
    layer: ReadLayer,
    color: string,
    css: CssDeclarations,
  ): void {
    if (layer.strokeWeight === READ_VALUE.mixed) {
      for (const [field, property] of SIDE_WEIGHTS) {
        const weight = layer[field] ?? 0;

        if (weight > 0) {
          css.set(property, this.#border(layer, weight, color));
        }
      }
    } else {
      const property = layer.strokeAlign === FIGMA_PAINT_GROUP.outside ? CSS_PROPERTY.outline : CSS_PROPERTY.border;

      css.set(property, this.#border(layer, layer.strokeWeight ?? PAINT_NUMBER.defaultWeight, color));
    }

    this.#centred(layer, css);
  }

  /** One border, its colour currentColor when the stroke has none CSS can write; a round or square cap is a note. */
  #line(
    layer: ReadLayer,
    color: PaintCss,
    css: CssDeclarations,
  ): void {
    const standing = new Turn(layer.rotation, undefined).lineAxis() === LINE_AXIS.standing;
    const weight = typeof layer.strokeWeight === "number" ? layer.strokeWeight : PAINT_NUMBER.defaultWeight;

    css.set(
      standing ? CSS_PROPERTY.borderLeft : CSS_PROPERTY.borderTop,
      this.#border(layer, weight, typeof color === "string" ? color : PAINT_VALUE.currentColor),
    );

    if (color !== null) {
      this.#centred(layer, css);
    }

    const cap = FIGMA_PAINT_GROUP.caps.find((name) => name === layer.strokeCap);

    if (cap !== undefined) {
      css.note(PAINT_NOTE.lineCap, cap.toLowerCase());
    }
  }

  /** `1px solid <colour>`: the weight to 2 decimals (C-012), dashed when the stroke has a dash pattern. */
  #border(
    layer: ReadLayer,
    weight: number,
    color: string,
  ): string {
    const style = layer.dashPattern === undefined ? PAINT_VALUE.solid : PAINT_VALUE.dashed;

    return PAINT_TEXT.border(this.#format.round(weight, PRECISION.stroke), style, color);
  }

  /** A centred stroke paints half of itself outside the layer's box, which a border-box border cannot. */
  #centred(layer: ReadLayer, css: CssDeclarations): void {
    if (layer.strokeAlign === FIGMA_PAINT_GROUP.centre) {
      css.note(PAINT_NOTE.strokeAlign, PAINT_VALUE.centre);
    }
  }
}
