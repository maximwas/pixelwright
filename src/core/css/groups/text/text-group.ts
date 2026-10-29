import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssScope, PropertyGroup } from "@/core/css/css.types.ts";
import {
  ALIGN_CSS,
  FIGMA_TEXT,
  LIST_STYLES,
  TEXT_ATTRIBUTES,
  TEXT_NOTE,
  TEXT_SOURCES,
  TEXT_VALUE,
  VERTICAL_CSS,
  WRAP_CSS,
} from "@/core/css/groups/text/text.constants.ts";
import { TEXT_RUN, type TextSegment } from "@/core/css/groups/text/text-run.ts";
import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

type Text = NonNullable<ReadLayer["text"]>;

/**
 * A text's CSS (C-110, C-116): its alignment, its longest run as the text's own style (the other runs become Spans) with
 * the text style it names, and what the box does as a whole: wrap, vertical alignment, lists and paragraphs.
 */
@injectable()
export class TextGroup implements PropertyGroup {
  readonly attributes = TEXT_ATTRIBUTES;
  readonly sources = TEXT_SOURCES;
  readonly #runs;
  readonly #lengths;

  constructor(runs = inject(TEXT_RUN), lengths = inject(CSS_LENGTH)) {
    this.#runs = runs;
    this.#lengths = lengths;
  }

  read({ layer, model, css }: CssScope): void {
    const text = layer.text;
    const align = text === undefined ? undefined : ALIGN_CSS[text.textAlignHorizontal];
    const base = text === undefined ? undefined : this.#runs.base(text.segments);

    if (align !== undefined) {
      css.set(CSS_PROPERTY.textAlign, align);
    }

    if (text === undefined || base === undefined) {
      return;
    }

    const run = this.#runs.read(base, model);
    // The fills group writes a text's one colour; a mixed one is its main run's.
    const own = ([property]: readonly [string, string]) =>
      property !== CSS_PROPERTY.color || layer.fills === READ_VALUE.mixed;

    for (const [property, value] of [...run.properties].filter(own)) {
      css.set(property, value);
    }

    for (const [property, value] of run.notes.filter(own)) {
      css.note(property, value);
    }

    if (run.textStyle !== undefined) {
      css.style(run.textStyle);
    }

    this.#block(layer, text, base, css);
  }

  /** What the box does as a whole: wrap, a fixed height's vertical alignment, lists and paragraphs. */
  #block(
    layer: ReadLayer,
    text: Text,
    base: TextSegment,
    css: CssDeclarations,
  ): void {
    const wrap = WRAP_CSS[base.textWrapStyle ?? ""];
    const vertical = VERTICAL_CSS[text.textAlignVertical];
    const list = text.segments.map((segment) => LIST_STYLES[segment.listOptions?.type ?? ""]).find(Boolean);
    const notes: readonly (readonly [string, string | undefined])[] = [
      [CSS_PROPERTY.alignContent, layer.layoutSizingVertical === FIGMA_TEXT.fixed ? vertical : undefined],
      [TEXT_NOTE.listStyle, list],
      [TEXT_NOTE.paragraphSpacing, this.#spacing(text.paragraphSpacing)],
      [TEXT_NOTE.listSpacing, this.#spacing(text.listSpacing)],
      [TEXT_NOTE.textIndent, this.#spacing(base.paragraphIndent)],
      [TEXT_NOTE.textBox, text.leadingTrim === FIGMA_TEXT.capHeight ? TEXT_VALUE.trimBoth : undefined],
      [TEXT_NOTE.hangingPunctuation, (text.hangingPunctuation ?? false) ? TEXT_VALUE.first : undefined],
    ];

    if (wrap !== undefined) {
      css.set(CSS_PROPERTY.textWrap, wrap);
    }

    for (const [property, value] of notes) {
      if (value !== undefined) {
        css.note(property, value);
      }
    }
  }

  #spacing(value: number | typeof READ_VALUE.mixed | undefined): string | undefined {
    return typeof value === "number" && value > 0 ? this.#lengths.px(value) : undefined;
  }
}
