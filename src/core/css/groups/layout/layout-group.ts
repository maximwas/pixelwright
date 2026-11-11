import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  ALIGN_CSS,
  FIGMA_LAYOUT,
  JUSTIFY_CSS,
  LAYOUT_ATTRIBUTES,
  LAYOUT_FIELD,
  LAYOUT_MODE,
  LAYOUT_NUMBER,
  LAYOUT_SOURCES,
  LAYOUT_TEXT,
  LAYOUT_VALUE,
  PADDING_FIELDS,
  SPREAD,
} from "@/core/css/groups/layout/layout.constants.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_VALUE } from "@/core/css/values/values.constants.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Tracks = ReadLayer["gridColumnSizes"];

type LengthField = (typeof LAYOUT_FIELD)[keyof typeof LAYOUT_FIELD];

/**
 * A frame's own layout read as CSS (C-030): auto layout as flex (direction, wrap, padding, alignment, the gap between
 * children and between wrapped lines), a grid as its tracks, gaps and padding. Figma's defaults are left out.
 */
@injectable()
export class LayoutGroup implements PropertyGroup {
  readonly attributes = LAYOUT_ATTRIBUTES;
  readonly sources = LAYOUT_SOURCES;
  readonly #lengths;
  readonly #format;

  constructor(lengths = inject(CSS_LENGTH), format = inject(NUMBER_FORMAT)) {
    this.#lengths = lengths;
    this.#format = format;
  }

  read(scope: CssScope): void {
    const { layoutMode } = scope.layer;

    if (layoutMode === LAYOUT_MODE.grid) {
      this.#grid(scope);
    } else if (layoutMode === LAYOUT_MODE.horizontal || layoutMode === LAYOUT_MODE.vertical) {
      this.#flex(scope);
    }
  }

  #flex(scope: CssScope): void {
    const { layer, css } = scope;
    const wraps = layer.layoutWrap === FIGMA_LAYOUT.wrap;

    css.set(CSS_PROPERTY.display, LAYOUT_VALUE.flex);

    if (layer.layoutMode === LAYOUT_MODE.vertical) {
      css.set(CSS_PROPERTY.flexDirection, LAYOUT_VALUE.column);
    }

    if (wraps) {
      css.set(CSS_PROPERTY.flexWrap, LAYOUT_VALUE.wrap);
    }

    this.#padding(scope);
    this.#alignment(layer, css);
    this.#gap(scope);

    if (wraps) {
      this.#lines(scope);
    }
  }

  #alignment(layer: ReadLayer, css: CssDeclarations): void {
    const justify = JUSTIFY_CSS[layer.primaryAxisAlignItems ?? FIGMA_LAYOUT.start];
    const align = ALIGN_CSS[layer.counterAxisAlignItems ?? FIGMA_LAYOUT.start];

    if (justify !== undefined) {
      css.set(CSS_PROPERTY.justifyContent, justify);
    }

    if (align !== undefined) {
      css.set(CSS_PROPERTY.alignItems, align);
    }
  }

  /** C-031, C-032: a gap only between two visible children or more, not when spread; a negative one is a note. */
  #gap(scope: CssScope): void {
    const { layer, css } = scope;
    const spaced = layer.children?.filter((child) => child.visible).length ?? layer.childCount;
    const spacing = layer.itemSpacing ?? 0;

    if (
      Object.hasOwn(SPREAD, layer.primaryAxisAlignItems ?? FIGMA_LAYOUT.start) ||
      spaced < LAYOUT_NUMBER.spacedChildren
    ) {
      return;
    }

    if (spacing < 0) {
      css.note(CSS_PROPERTY.gap, LAYOUT_TEXT.overlap(this.#lengths.px(spacing)));
    } else {
      this.#length(scope, CSS_PROPERTY.gap, LAYOUT_FIELD.itemSpacing);
    }
  }

  /**
   * C-033: between wrapped lines, rows of a horizontal wrap and columns of a vertical one. CSS's gap spaces the lines
   * too, so the line gap is written only when it differs from the gap written, 0 included; Figma's null follows it.
   */
  #lines({ layer, css, model }: CssScope): void {
    const between = layer.layoutMode === LAYOUT_MODE.vertical ? CSS_PROPERTY.columnGap : CSS_PROPERTY.rowGap;

    if (typeof layer.counterAxisSpacing === "number") {
      const lines = this.#lengths.bound(layer, LAYOUT_FIELD.counterAxisSpacing, layer.counterAxisSpacing, model);

      if (lines !== (css.get(CSS_PROPERTY.gap) ?? CSS_VALUE.zero)) {
        css.set(between, lines);
      }
    }

    if (layer.counterAxisAlignContent === FIGMA_LAYOUT.spaceBetween) {
      css.set(CSS_PROPERTY.alignContent, LAYOUT_VALUE.spaceBetween);
    }
  }

  /** A grid: its tracks (or its column count when the read has no track sizes), padding and gaps. */
  #grid(scope: CssScope): void {
    const { layer, css } = scope;
    const count = layer.gridColumnCount;
    const columns =
      this.#tracks(layer.gridColumnSizes) ??
      (count === undefined ? undefined : LAYOUT_TEXT.repeat(count, LAYOUT_TEXT.share(LAYOUT_NUMBER.oneShare)));
    const rows = this.#tracks(layer.gridRowSizes);

    css.set(CSS_PROPERTY.display, LAYOUT_VALUE.grid);

    if (columns !== undefined) {
      css.set(CSS_PROPERTY.gridTemplateColumns, columns);
    }

    if (rows !== undefined) {
      css.set(CSS_PROPERTY.gridTemplateRows, rows);
    }

    this.#padding(scope);
    this.#length(scope, CSS_PROPERTY.columnGap, LAYOUT_FIELD.gridColumnGap);
    this.#length(scope, CSS_PROPERTY.rowGap, LAYOUT_FIELD.gridRowGap);
  }

  /** Grid tracks: a flex track in `fr`, a fixed one in pixels, a hugging one `auto`; equal tracks as repeat(). */
  #tracks(tracks: Tracks): string | undefined {
    if (tracks === undefined || tracks.length === 0) {
      return undefined;
    }

    const sizes = tracks.map(({ type, value }) => {
      if (type === FIGMA_LAYOUT.fixedTrack) {
        return this.#lengths.px(value ?? 0);
      }

      return type === FIGMA_LAYOUT.hugTrack
        ? LAYOUT_VALUE.hugTrack
        : LAYOUT_TEXT.share(this.#format.round(value ?? LAYOUT_NUMBER.oneShare, PRECISION.decimal));
    });
    const [first = ""] = sizes;

    return sizes.length >= LAYOUT_NUMBER.repeatFrom && sizes.every((size) => size === first)
      ? LAYOUT_TEXT.repeat(sizes.length, first)
      : sizes.join(LAYOUT_VALUE.trackJoint);
  }

  /** The padding as its shorthand, flex or grid alike, a bound side as its var(); none when every side is 0. */
  #padding({ layer, css, model }: CssScope): void {
    const sides = PADDING_FIELDS.map((field) => this.#lengths.bound(layer, field, layer[field] ?? 0, model));
    const [top = "", right = "", bottom = "", left = ""] = sides;

    if (sides.some((side) => side !== CSS_VALUE.zero)) {
      css.set(CSS_PROPERTY.padding, this.#lengths.shorthand([top, right, bottom, left]));
    }
  }

  /** A length field as `property`, its variable's var() when bound; nothing for a zero or a missing one. */
  #length(
    { layer, css, model }: CssScope,
    property: string,
    field: LengthField,
  ): void {
    const value = layer[field];
    const written = typeof value === "number" ? this.#lengths.bound(layer, field, value, model) : CSS_VALUE.zero;

    if (written !== CSS_VALUE.zero) {
      css.set(property, written);
    }
  }
}

export const LAYOUT_GROUP = new InjectionToken<LayoutGroup>("LayoutGroup");
