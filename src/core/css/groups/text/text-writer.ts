import { inject, injectable } from "@needle-di/core";
import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { FONT_VALUES, type FontSpec } from "@/core/css/fonts/font-values.ts";
import { FILLS_WRITER } from "@/core/css/groups/paint/fills-writer.ts";
import {
  ALIGN_FIGMA,
  CASE_FIGMA,
  DECORATION_LENGTHS,
  DECORATION_PROPERTIES,
  DECORATION_STYLE_FIGMA,
  LINE_FIGMA,
  TEXT_ERROR,
  TEXT_PATTERN,
  TEXT_VALUE,
  TEXT_WRITTEN,
  WRAP_FIGMA,
} from "@/core/css/groups/text/text.constants.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { Color } from "@/core/kernel/color/color.ts";
import { TAG } from "@/core/xml/tags.constants.ts";
import { INTENT_DECORATION, INTENT_KEY, INTENT_TEXT_UNIT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Decoration = NonNullable<FigmaProps["textDecoration"]>;
type Lengths = Pick<Decoration, "offset" | "thickness">;
/** A keyword's table of Figma values and the property it sets. */
type Keyword<Key extends keyof FigmaProps> = {
  readonly table: Readonly<Record<string, Exclude<FigmaProps[Key], undefined>>>;
  readonly key: Key;
};

/**
 * What a Text and its Spans set, written back (C-112..C-118): the text style, the font, letter spacing, case, the
 * decoration as the one property Figma keeps it in (completed from the layer), alignment, wrapping, and the colour.
 * Applying a text style resets what it covers, so the font, spacing, case and decoration the element gives are written
 * again from its own values (C-118).
 */
@injectable()
export class TextWriter implements PropertyWriter {
  readonly attributes = TEXT_WRITTEN;
  readonly #fills;
  readonly #fonts;
  readonly #split;

  constructor(
    fills = inject(FILLS_WRITER),
    fonts = inject(FONT_VALUES),
    split = inject(CSS_SPLIT),
  ) {
    this.#fills = fills;
    this.#fonts = fonts;
    this.#split = split;
  }

  write(input: WriteInput, out: WriteOutput): void {
    const { own, changed } = input;
    const restyled = input.restyled ?? false;
    const styled = (attributes: readonly string[]) =>
      (restyled && attributes.some((name) => own(name) !== undefined)) || attributes.some(changed);

    if (changed(ATTRIBUTE.textStyle)) {
      out.set(INTENT_KEY.textStyle, own(ATTRIBUTE.textStyle) ?? "", ATTRIBUTE.textStyle);
    }

    if (styled([CSS_PROPERTY.font])) {
      this.#font(input, out);
    }

    if (styled([CSS_PROPERTY.letterSpacing])) {
      this.#letterSpacing(own(CSS_PROPERTY.letterSpacing) ?? "", out);
    }

    if (styled([CSS_PROPERTY.textTransform])) {
      this.#keyword(CSS_PROPERTY.textTransform, own, { table: CASE_FIGMA, key: INTENT_KEY.textCase }, out);
    }

    if (styled(DECORATION_PROPERTIES)) {
      this.#decoration(restyled ? { ...input, merged: own } : input, out);
    }

    this.#box(input, out);
  }

  /** What a text's box sets as a whole, never a text style's: alignment, wrapping, and its colour. */
  #box({ own, changed }: WriteInput, out: WriteOutput): void {
    if (changed(CSS_PROPERTY.textAlign)) {
      this.#keyword(CSS_PROPERTY.textAlign, own, { table: ALIGN_FIGMA, key: INTENT_KEY.textAlignHorizontal }, out);
    }

    if (changed(CSS_PROPERTY.textWrap)) {
      this.#keyword(CSS_PROPERTY.textWrap, own, { table: WRAP_FIGMA, key: INTENT_KEY.textWrapStyle }, out);
    }

    if (changed(CSS_PROPERTY.color)) {
      const paints = this.#fills.paints(CSS_PROPERTY.color, (own(CSS_PROPERTY.color) ?? "").trim(), out);

      if (paints !== null) {
        out.set(INTENT_KEY.textFills, paints, CSS_PROPERTY.color);
      }
    }
  }

  #font({ own, tag }: WriteInput, out: WriteOutput): void {
    const value = own(CSS_PROPERTY.font) ?? "";
    const font: FontSpec | null = this.#fonts.font(value);

    if (font === null) {
      out.fail(CSS_PROPERTY.font, TEXT_ERROR.badFont(value));
    } else if (tag === TAG.TEXT_PATH && font.lineHeight.unit !== INTENT_TEXT_UNIT.AUTO) {
      // Figma would take the font and drop the line height, so the same call would be "changed" every time.
      out.fail(
        CSS_PROPERTY.font,
        TEXT_ERROR.pathLineHeight,
        TEXT_ERROR.pathLineHeightHint(value.replace(TEXT_PATTERN.lineHeight, "")),
      );
    } else {
      out.set(INTENT_KEY.font, font, CSS_PROPERTY.font);
    }
  }

  #letterSpacing(value: string, out: WriteOutput): void {
    const spacing = this.#fonts.letterSpacing(value);

    if (spacing === null) {
      out.fail(CSS_PROPERTY.letterSpacing, TEXT_ERROR.badSpacing(value));
    } else {
      out.set(INTENT_KEY.letterSpacing, spacing, CSS_PROPERTY.letterSpacing);
    }
  }

  /** A CSS keyword as the Figma value its table gives it; any other value is the attribute's error. */
  #keyword<Key extends keyof FigmaProps>(
    attribute: string,
    own: WriteInput["own"],
    { table, key }: Keyword<Key>,
    out: WriteOutput,
  ): void {
    const value = own(attribute) ?? "";
    const mapped = Object.hasOwn(table, value) ? table[value] : undefined;

    if (mapped === undefined) {
      out.fail(attribute, TEXT_ERROR.badKeyword(attribute, value, Object.keys(table).join(TEXT_VALUE.joint)));
    } else {
      out.set(key, mapped, attribute);
    }
  }

  /** The decoration as one: the shorthand's line, style and colour, with the offset and thickness beside it (C-115). */
  #decoration({ merged, changed }: WriteInput, out: WriteOutput): void {
    const value = merged(CSS_PROPERTY.textDecoration);
    const words = value === undefined ? [] : this.#split.split(value, CSS_SEPARATOR.space);
    const line = words.find((word) => Object.hasOwn(LINE_FIGMA, word));
    const style = words.find((word) => Object.hasOwn(DECORATION_STYLE_FIGMA, word));
    const rest = words.filter((word) => word !== line && word !== style).join(TEXT_VALUE.space);
    const color = rest === "" ? null : Color.parse(rest);

    if (value !== undefined && (line === undefined || (rest !== "" && color === null))) {
      out.fail(CSS_PROPERTY.textDecoration, TEXT_ERROR.badDecoration(value));

      return;
    }

    const lengths = this.#lengths(merged, out);
    const figmaLine = LINE_FIGMA[(line ?? TEXT_VALUE.none) as keyof typeof LINE_FIGMA];
    const figmaStyle =
      style === undefined ? undefined : DECORATION_STYLE_FIGMA[style as keyof typeof DECORATION_STYLE_FIGMA];

    if (lengths === null) {
      return;
    }

    if (figmaLine !== INTENT_DECORATION.NONE && figmaStyle === DECORATION_STYLE_FIGMA.dashed) {
      out.fail(CSS_PROPERTY.textDecoration, TEXT_ERROR.dashed);

      return;
    }

    const decoration: Decoration = {
      line: figmaLine,
      ...(figmaStyle === undefined ? {} : { style: figmaStyle }),
      ...(color === null ? {} : { color: color.value() }),
      ...lengths,
    };

    out.set(INTENT_KEY.textDecoration, decoration, DECORATION_PROPERTIES.find(changed) ?? CSS_PROPERTY.textDecoration);
  }

  /** The offset and thickness given, in px or em, or auto; null after one that is neither. */
  #lengths(merged: WriteInput["merged"], out: WriteOutput): Lengths | null {
    const lengths: { -readonly [Key in keyof Lengths]: Lengths[Key] } = {};

    for (const [attribute, key] of DECORATION_LENGTHS) {
      const length = merged(attribute);
      const read = length === undefined ? undefined : this.#fonts.textLength(length);

      if (read === null) {
        out.fail(attribute, TEXT_ERROR.badLength(attribute, length ?? ""));

        return null;
      }

      if (read !== undefined) {
        lengths[key] = read;
      }
    }

    return lengths;
  }
}
