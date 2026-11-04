import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { FONT_SHORTHAND } from "@/core/css/fonts/font-shorthand.ts";
import { CASE_CSS } from "@/core/css/fonts/fonts.constants.ts";
import { UNMAPPED_NOTE } from "@/core/css/groups/paint/paint.constants.ts";
import {
  DECORATION_LINES,
  DECORATION_PROPERTIES,
  DECORATION_STYLES,
  DEFAULT_FONT_AXES,
  FIGMA_TEXT,
  SMALL_CAPS,
  STYLED_PART,
  TEXT_NOTE,
  TEXT_TEXT,
  TEXT_VALUE,
} from "@/core/css/groups/text/text.constants.ts";
import { PAINT_LIST } from "@/core/css/paints/paint-list.ts";
import { UNMAPPED_PAINT } from "@/core/css/paints/paints.constants.ts";
import type { CssDeclaration } from "@/core/css/registry/css-declarations.ts";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A run of text with one set of styles. */
export type TextSegment = NonNullable<ReadLayer["text"]>["segments"][number];

type Style = ReadModel["styles"][string];

type StyledPart = (typeof STYLED_PART)[keyof typeof STYLED_PART];

/** A run as CSS: what it writes, in the order written, what it cannot write back, and its text style's name. */
export interface RunCss {
  readonly properties: Map<string, string>;
  readonly notes: CssDeclaration[];
  readonly textStyle: string | undefined;
}

/** A text's own run: the segment it comes from, its CSS, and whether the text carries its runs' one decoration. */
export interface MainRun {
  readonly base: TextSegment;
  readonly css: RunCss;
  /** Every run has the same decoration, so the text carries it; otherwise each run's Span writes its own in full. */
  readonly sharedDecoration: boolean;
}

/**
 * A run of text as CSS (C-110, C-111, C-117): the font shorthand, spacing, case, decoration and colour, each left out
 * where its text style sets it the same; OpenType features and the axes a browser would not draw by itself as notes.
 */
@injectable()
export class TextRun {
  readonly #fonts;
  readonly #paints;
  readonly #format;
  readonly #names;

  constructor(
    fonts = inject(FONT_SHORTHAND),
    paints = inject(PAINT_LIST),
    format = inject(NUMBER_FORMAT),
    names = inject(TOKEN_NAMES),
  ) {
    this.#fonts = fonts;
    this.#paints = paints;
    this.#format = format;
    this.#names = names;
  }

  /**
   * The text's own run (C-110). CSS draws an ancestor's decoration through every child and no Span can take it off,
   * so the text keeps a decoration only when every run has the same one; otherwise it has none (`none` over a text
   * style that sets one) and each run's Span writes its own (`read` with `fullDecoration`).
   */
  main(segments: readonly TextSegment[], model: ReadModel): MainRun | undefined {
    const base = this.#base(segments);

    if (base === undefined) {
      return undefined;
    }

    const css = this.read(base, model);
    const sharedDecoration = new Set(segments.map((segment) => this.#decorationOf(segment, model))).size === 1;
    const styled = DECORATION_LINES[this.#style(base, model)?.textDecoration ?? ""] !== undefined;

    if (!sharedDecoration) {
      for (const property of DECORATION_PROPERTIES) {
        css.properties.delete(property);
      }
    }

    if (styled && !(sharedDecoration && DECORATION_LINES[base.textDecoration] !== undefined)) {
      css.properties.set(CSS_PROPERTY.textDecoration, TEXT_VALUE.none);
    }

    return { base, css, sharedDecoration };
  }

  /** C-110: the run covering the most characters, the text's own style; a tie goes to the first. */
  #base(segments: readonly TextSegment[]): TextSegment | undefined {
    return segments.reduce<TextSegment | undefined>(
      (longest, segment) =>
        longest === undefined || segment.end - segment.start > longest.end - longest.start ? segment : longest,
      undefined,
    );
  }

  /** A run as CSS; with `fullDecoration`, its decoration even where its text style sets the same (see `main`). */
  read(
    segment: TextSegment,
    model: ReadModel,
    fullDecoration = false,
  ): RunCss {
    const style = this.#style(segment, model);
    const run: RunCss = {
      properties: new Map(),
      notes: [],
      textStyle: style === undefined ? undefined : this.#names.styleName(style),
    };
    const same = (part: StyledPart) => style !== undefined && this.#same(style, segment, part);

    if (!(same(STYLED_PART.fontName) && same(STYLED_PART.fontSize) && same(STYLED_PART.lineHeight))) {
      run.properties.set(CSS_PROPERTY.font, this.#fonts.font(segment));
    }

    const spacing = this.#fonts.letterSpacing(segment.letterSpacing);

    if (spacing !== null && !same(STYLED_PART.letterSpacing)) {
      run.properties.set(CSS_PROPERTY.letterSpacing, spacing);
    }

    this.#case(segment, same(STYLED_PART.textCase), run);

    const line = DECORATION_LINES[segment.textDecoration];

    if (line !== undefined && (fullDecoration || !same(STYLED_PART.textDecoration))) {
      this.#decoration(segment, line, model, run.properties);
    }

    this.#features(segment, run.notes);
    this.#color(segment, model, run);

    return run;
  }

  #style(segment: TextSegment, model: ReadModel): Style | undefined {
    const found = segment.textStyleId === "" ? undefined : model.styles[segment.textStyleId];

    return found?.type === FIGMA_TEXT.textStyle ? found : undefined;
  }

  /** A run's decoration in full, as one text to compare runs by; empty for none. */
  #decorationOf(segment: TextSegment, model: ReadModel): string {
    const line = DECORATION_LINES[segment.textDecoration];
    const properties = new Map<string, string>();

    if (line !== undefined) {
      this.#decoration(segment, line, model, properties);
    }

    return JSON.stringify([...properties]);
  }

  #case(
    segment: TextSegment,
    styled: boolean,
    run: RunCss,
  ): void {
    const transform = CASE_CSS[segment.textCase];
    const caps = SMALL_CAPS[segment.textCase];

    if (transform !== undefined && !styled) {
      run.properties.set(CSS_PROPERTY.textTransform, transform);
    } else if (caps !== undefined) {
      run.notes.push([TEXT_NOTE.fontVariantCaps, caps]);
    }
  }

  /** An underline or strike: its line, style and colour in the shorthand, its offset and thickness on their own. */
  #decoration(
    segment: TextSegment,
    line: string,
    model: ReadModel,
    properties: Map<string, string>,
  ): void {
    const paint = segment.textDecorationColor?.value;
    const color =
      paint === undefined || paint === READ_VALUE.autoColor ? null : this.#paints.css([paint], undefined, model);
    const offset = segment.textDecorationOffset == null ? null : this.#fonts.length(segment.textDecorationOffset);
    const thickness =
      segment.textDecorationThickness == null ? null : this.#fonts.length(segment.textDecorationThickness);

    properties.set(
      CSS_PROPERTY.textDecoration,
      [line, DECORATION_STYLES[segment.textDecorationStyle ?? ""], typeof color === "string" ? color : undefined]
        .filter((part) => part !== undefined)
        .join(TEXT_VALUE.space),
    );

    if (offset !== null) {
      properties.set(CSS_PROPERTY.textUnderlineOffset, offset);
    }

    if (thickness !== null) {
      properties.set(CSS_PROPERTY.textDecorationThickness, thickness);
    }
  }

  /**
   * C-117, FX-066: OpenType features, and the variable axes the shorthand does not already say (wght at the weight,
   * opsz at the size: font-optical-sizing is auto) and not at a browser's default.
   */
  #features(segment: TextSegment, notes: CssDeclaration[]): void {
    const features = Object.entries(segment.openTypeFeatures ?? {});
    const axes = Object.entries(segment.fontName.variationSettings ?? {}).filter(
      ([axis, value]) =>
        !(axis === FIGMA_TEXT.weightAxis && value === segment.fontWeight) &&
        !(axis === FIGMA_TEXT.opticalSizeAxis && value === segment.fontSize) &&
        DEFAULT_FONT_AXES[axis] !== value,
    );

    if (features.length > 0) {
      notes.push([
        TEXT_NOTE.fontFeatureSettings,
        features.map(([tag, on]) => TEXT_TEXT.feature(tag, on)).join(TEXT_VALUE.joint),
      ]);
    }

    if (axes.length > 0) {
      notes.push([
        TEXT_NOTE.fontVariationSettings,
        axes
          .map(([axis, value]) => TEXT_TEXT.axis(axis, this.#format.round(value, PRECISION.decimal)))
          .join(TEXT_VALUE.joint),
      ]);
    }
  }

  /** The run's colour; a gradient or image fill is the fixed note (D-20). */
  #color(
    segment: TextSegment,
    model: ReadModel,
    run: RunCss,
  ): void {
    const color = this.#paints.css(segment.fills, segment.fillStyleId === "" ? undefined : segment.fillStyleId, model);

    if (color === UNMAPPED_PAINT) {
      run.notes.push([CSS_PROPERTY.color, UNMAPPED_NOTE[CSS_PROPERTY.color]]);
    } else if (color !== null) {
      run.properties.set(CSS_PROPERTY.color, color);
    }
  }

  /** A variable font's run carries axis values its style's font name lacks: family and style decide the font. */
  #same(
    style: Style,
    segment: TextSegment,
    part: StyledPart,
  ): boolean {
    if (part === STYLED_PART.fontName) {
      return style.fontName?.family === segment.fontName.family && style.fontName.style === segment.fontName.style;
    }

    if (part === STYLED_PART.lineHeight || part === STYLED_PART.letterSpacing) {
      const own = style[part];

      return own?.unit === segment[part].unit && own.value === segment[part].value;
    }

    return style[part] === segment[part];
  }
}

export const TEXT_RUN = new InjectionToken<TextRun>("TextRun");
