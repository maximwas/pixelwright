import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  FIGMA_PAINT_GROUP,
  FILLS_ATTRIBUTES,
  FILLS_SOURCES,
  TEXT_TYPES,
  UNMAPPED_NOTE,
  VECTOR_TYPES,
} from "@/core/css/groups/paint/paint.constants.ts";
import { PAINT_LIST } from "@/core/css/paints/paint-list.ts";
import { UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * A layer's fills (C-080): a box's are its background, top first; a text's its colour. A vector's and a line's are
 * their own drawing, not CSS. A paint the table cannot write is the fixed note (D-20).
 */
@injectable()
export class FillsGroup implements PropertyGroup {
  readonly attributes = FILLS_ATTRIBUTES;
  readonly sources = FILLS_SOURCES;
  readonly #paints;

  constructor(paints = inject(PAINT_LIST)) {
    this.#paints = paints;
  }

  read({ layer, model, css }: CssScope): void {
    if ((VECTOR_TYPES[layer.type] ?? false) || layer.type === FIGMA_PAINT_GROUP.line) {
      return;
    }

    const { fills, fillStyleId } = layer;

    // A text's differing fills are its runs' (the text item writes them per run).
    if (fills === undefined || fills === READ_VALUE.mixed) {
      return;
    }

    const property = (TEXT_TYPES[layer.type] ?? false) ? CSS_PROPERTY.color : CSS_PROPERTY.background;
    const value = this.#paints.css(fills, fillStyleId === READ_VALUE.mixed ? undefined : fillStyleId, model);

    if (value === UNMAPPED_PAINT) {
      css.note(property, UNMAPPED_NOTE[property]);
    } else if (value !== null) {
      css.set(property, value);
    }
  }
}
