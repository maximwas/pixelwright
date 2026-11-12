import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import { APPEARANCE_TEXT } from "@/core/css/groups/appearance/appearance.constants.ts";
import {
  BACKGROUND_BLEND_CSS,
  FIGMA_PAINT_GROUP,
  FILL_NOTE,
  FILLS_ATTRIBUTES,
  FILLS_SOURCES,
  PAINT_NOTE,
  PAINT_VALUE,
  TEXT_TYPES,
  UNMAPPED_NOTE,
  VECTOR_TYPES,
} from "@/core/css/groups/paint/paint.constants.ts";
import { PAINT_LIST } from "@/core/css/paints/paint-list.ts";
import { FIGMA_PAINT, PAINTS_VALUE, UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import type { Paint } from "@/core/css/paints/solid-paint.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * A layer's fills (C-080): a box's are its background, top first; a text's its colour. A vector's and a line's are
 * their own drawing, not CSS. A paint the table cannot write is the fixed note (D-20), a video its own (D-23). Fills that
 * blend with those under them are background-blend-mode, one mode per background.
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
    const value = this.#paints.css(
      fills,
      fillStyleId === READ_VALUE.mixed ? undefined : fillStyleId,
      model,
      property === CSS_PROPERTY.background ? layer : null,
    );

    if (value === UNMAPPED_PAINT) {
      const video = fills.some((paint) => paint.type === FIGMA_PAINT.video && (paint.visible ?? true));

      css.note(property, video ? FILL_NOTE.video : UNMAPPED_NOTE[property]);
    } else if (value !== null) {
      css.set(property, value);
      this.#blend(fills, property, css);
    }
  }

  /**
   * The visible fills' modes top first, as background has them; a mode CSS lacks and a text's (color cannot blend)
   * are notes.
   */
  #blend(
    fills: readonly Paint[],
    property: string,
    css: CssDeclarations,
  ): void {
    const modes = fills
      .filter((paint) => paint.visible ?? true)
      .reverse()
      .map((paint) => paint.blendMode ?? FIGMA_PAINT_GROUP.normal);

    if (modes.every((mode) => BACKGROUND_BLEND_CSS[mode] === PAINT_VALUE.normal)) {
      return;
    }

    const value = modes
      .map((mode) => BACKGROUND_BLEND_CSS[mode] ?? APPEARANCE_TEXT.blend(mode))
      .join(PAINTS_VALUE.layerJoint);

    if (property === CSS_PROPERTY.color) {
      css.note(PAINT_NOTE.fillBlendMode, value);
    } else if (modes.every((mode) => BACKGROUND_BLEND_CSS[mode] !== undefined)) {
      css.set(CSS_PROPERTY.backgroundBlendMode, value);
    } else {
      css.note(CSS_PROPERTY.backgroundBlendMode, value);
    }
  }
}
