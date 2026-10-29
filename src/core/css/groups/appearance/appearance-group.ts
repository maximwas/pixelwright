import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  APPEARANCE_ATTRIBUTES,
  APPEARANCE_NOTE,
  APPEARANCE_NUMBER,
  APPEARANCE_SOURCES,
  APPEARANCE_TEXT,
  APPEARANCE_VALUE,
  BLEND_CSS,
  CORNERS,
  FIGMA_APPEARANCE,
  UNROUNDED,
} from "@/core/css/groups/appearance/appearance.constants.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_VALUE } from "@/core/css/values/values.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

type LayoutGrid = NonNullable<ReadLayer["layoutGrids"]>[number];

/**
 * How a layer shows as a whole (C-070..C-073): its opacity, blend mode, clipping and a text's truncation, its corners,
 * and its layout grids as a note. A mask is the element's `mask` attribute, which DesignBuilder writes.
 */
@injectable()
export class AppearanceGroup implements PropertyGroup {
  readonly attributes = APPEARANCE_ATTRIBUTES;
  readonly sources = APPEARANCE_SOURCES;
  readonly #lengths;
  readonly #format;

  constructor(lengths = inject(CSS_LENGTH), format = inject(NUMBER_FORMAT)) {
    this.#lengths = lengths;
    this.#format = format;
  }

  read(scope: CssScope): void {
    const { layer, css } = scope;

    if (layer.opacity !== undefined) {
      css.set(CSS_PROPERTY.opacity, String(this.#format.round(layer.opacity, PRECISION.decimal)));
    }

    this.#blend(layer, css);

    if (layer.clipsContent ?? false) {
      css.set(CSS_PROPERTY.overflow, APPEARANCE_VALUE.hidden);
    }

    this.#truncation(layer, css);
    this.#radius(scope);
    this.#grids(layer, css);
  }

  /** A blend mode CSS has; one it has not is a note, Figma's own CSS for it when the read has it (C-070). */
  #blend(layer: ReadLayer, css: CssDeclarations): void {
    if (layer.blendMode === undefined) {
      return;
    }

    const blend = BLEND_CSS[layer.blendMode];

    if (blend === undefined) {
      css.note(
        CSS_PROPERTY.mixBlendMode,
        layer.css?.[CSS_PROPERTY.mixBlendMode] ?? APPEARANCE_TEXT.blend(layer.blendMode),
      );
    } else {
      css.set(CSS_PROPERTY.mixBlendMode, blend);
    }
  }

  /** C-073: a text truncated on one line is CSS's ellipsis (overflow writes it back); more lines are a line clamp. */
  #truncation(layer: ReadLayer, css: CssDeclarations): void {
    const text = layer.text;

    if (text?.textTruncation !== FIGMA_APPEARANCE.truncated) {
      return;
    }

    if ((text.maxLines ?? APPEARANCE_NUMBER.oneLine) <= APPEARANCE_NUMBER.oneLine) {
      css.set(CSS_PROPERTY.overflow, APPEARANCE_VALUE.hidden);
      css.set(CSS_PROPERTY.textOverflow, APPEARANCE_VALUE.ellipsis);
      css.set(CSS_PROPERTY.whiteSpace, APPEARANCE_VALUE.nowrap);
    } else {
      css.note(APPEARANCE_NOTE.lineClamp, String(text.maxLines));
    }
  }

  /** C-071: an ellipse is round; else one radius, or four when the corners differ, top left first. */
  #radius({ layer, css, model }: CssScope): void {
    if (layer.type === FIGMA_APPEARANCE.ellipse) {
      css.set(CSS_PROPERTY.borderRadius, APPEARANCE_VALUE.round);
    } else if ((UNROUNDED[layer.type] ?? false) || layer.cornerRadius === undefined) {
      return;
    } else if (layer.cornerRadius === READ_VALUE.mixed) {
      const corners = CORNERS.map((corner) => this.#lengths.bound(layer, corner, layer[corner] ?? 0, model));

      css.set(CSS_PROPERTY.borderRadius, corners.join(APPEARANCE_VALUE.cornerJoint));
    } else {
      // One radius binds all four corners alike: the top left one's variable names it, as 0.7.0 read it (T-163).
      const radius = this.#lengths.bound(layer, CORNERS[0], layer.cornerRadius, model);

      if (radius !== CSS_VALUE.zero) {
        css.set(CSS_PROPERTY.borderRadius, radius);
      }
    }
  }

  /** C-072: the visible layout grids, read only: the columns, rows or square grid the design is laid on. */
  #grids(layer: ReadLayer, css: CssDeclarations): void {
    const grids = (layer.layoutGrids ?? []).filter((grid) => grid.visible ?? true).map((grid) => this.#grid(grid));

    if (grids.length > 0) {
      css.note(APPEARANCE_NOTE.layoutGrid, grids.join(APPEARANCE_VALUE.gridJoint));
    }
  }

  /** "12 columns stretch, gutter 24px, margin 120px", "4 rows min 40px wide, gutter 8px, offset 0", "8px grid". */
  #grid(grid: LayoutGrid): string {
    const section = this.#lengths.px(grid.sectionSize ?? 0);

    if (grid.pattern === FIGMA_APPEARANCE.squareGrid) {
      return APPEARANCE_TEXT.squareGrid(section);
    }

    const unit = grid.pattern === FIGMA_APPEARANCE.rows ? APPEARANCE_VALUE.rows : APPEARANCE_VALUE.columns;
    const alignment = (grid.alignment ?? FIGMA_APPEARANCE.stretch).toLowerCase();
    const stretched = alignment === APPEARANCE_VALUE.stretch;
    const edge = stretched ? APPEARANCE_VALUE.margin : APPEARANCE_VALUE.offset;

    return [
      APPEARANCE_TEXT.lineGrid(grid.count ?? APPEARANCE_NUMBER.oneLineGrid, unit, alignment),
      stretched ? "" : APPEARANCE_TEXT.wide(section),
      APPEARANCE_TEXT.gutter(this.#lengths.px(grid.gutterSize ?? 0)),
      alignment === APPEARANCE_VALUE.center ? "" : APPEARANCE_TEXT.edge(edge, this.#lengths.px(grid.offset ?? 0)),
    ].join("");
  }
}
