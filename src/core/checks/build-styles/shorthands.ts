import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  BORDER_STYLES,
  BUILD_STYLES_PATTERN,
  BUILD_STYLES_TEXT,
  BUILD_STYLES_WORD,
  CORNERS,
  DECORATION_LINES,
  DECORATION_STYLES,
  FLEX_GROWS,
  LONGHAND,
  LONGHAND_KIND,
  LONGHAND_KINDS,
  SIDES,
} from "@/core/checks/build-styles/build-styles.constants.ts";
import type { Longhand, LonghandKind } from "@/core/checks/build-styles/build-styles.types.ts";
import { Dimension } from "@/core/checks/build-styles/dimension.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_VAR } from "@/core/css/values/css-var.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";

type Tokens = Readonly<Record<string, string>>;

/** The longhands one design attribute sets, from its value as written. */
type Expander = (written: string, tokens: Tokens) => Longhand[];

/** The longhand a word of a shorthand sets, told by the value it shows. */
interface WordClass {
  readonly property: string;
  readonly kind: LonghandKind;
  readonly fits: (value: string) => boolean;
}

/**
 * The shorthands design_read writes (K-048), spread into the longhands a computed style holds: padding and radius
 * sides, gap and overflow pairs, a border's or an outline's words sorted by what they look like, a background's colour
 * and images, design_read's own font shorthand, flex as its grow, a decoration's words. Each longhand keeps the var()
 * it comes from. Own code: the expansion libraries are unmaintained, and the table would stay ours anyway.
 */
@injectable()
export class Shorthands {
  readonly #split;
  readonly #vars;
  readonly #expanders: Readonly<Record<string, Expander>> = {
    [CSS_PROPERTY.padding]: this.#sides(
      CSS_PROPERTY.padding,
      SIDES.map((side) => BUILD_STYLES_TEXT.side(CSS_PROPERTY.padding, side)),
    ),
    [CSS_PROPERTY.borderRadius]: this.#sides(CSS_PROPERTY.borderRadius, CORNERS.map(BUILD_STYLES_TEXT.corner)),
    [CSS_PROPERTY.gap]: this.#pair(
      CSS_PROPERTY.gap,
      [CSS_PROPERTY.rowGap, CSS_PROPERTY.columnGap],
      LONGHAND_KIND.length,
    ),
    [CSS_PROPERTY.overflow]: this.#pair(
      CSS_PROPERTY.overflow,
      [LONGHAND.overflowX, LONGHAND.overflowY],
      LONGHAND_KIND.keyword,
    ),
    [CSS_PROPERTY.border]: (written, tokens) =>
      SIDES.flatMap((side) =>
        this.#sorted(written, tokens, this.#strokeWords(BUILD_STYLES_TEXT.side(CSS_PROPERTY.border, side))),
      ),
    ...Object.fromEntries(
      SIDES.map((side): [string, Expander] => {
        const prefix = BUILD_STYLES_TEXT.side(CSS_PROPERTY.border, side);

        return [prefix, (written, tokens) => this.#sorted(written, tokens, this.#strokeWords(prefix))];
      }),
    ),
    [CSS_PROPERTY.outline]: (written, tokens) => this.#sorted(written, tokens, this.#strokeWords(CSS_PROPERTY.outline)),
    [CSS_PROPERTY.background]: (written, tokens) => this.#background(written, tokens),
    [CSS_PROPERTY.font]: (written, tokens) => this.#font(written, tokens),
    [CSS_PROPERTY.flex]: (written, tokens) => this.#flex(written, tokens),
    [CSS_PROPERTY.textDecoration]: (written, tokens) => this.#sorted(written, tokens, this.#decorationWords()),
  };

  constructor(split = inject(CSS_SPLIT), vars = inject(CSS_VAR)) {
    this.#split = split;
    this.#vars = vars;
  }

  /** The computed properties one design attribute sets, each with its value as written. */
  longhands(
    name: string,
    written: string,
    tokens: Tokens,
  ): Longhand[] {
    const expander = this.#expanders[name];

    return expander === undefined
      ? [this.#longhand(name, LONGHAND_KINDS[name] ?? LONGHAND_KIND.keyword, written, tokens)]
      : expander(written, tokens);
  }

  /** What a text style sets: its font shorthand, then the declarations after it ("font; letter-spacing: x"). */
  textStyle(value: string, tokens: Tokens): Longhand[] {
    const [font, ...declarations] = this.#split.split(value, CSS_SEPARATOR.semicolon);

    return [
      ...(font === undefined ? [] : this.longhands(CSS_PROPERTY.font, font, tokens)),
      ...declarations.flatMap((declaration) => {
        const colon = declaration.indexOf(BUILD_STYLES_WORD.colon);

        return colon === -1
          ? []
          : this.longhands(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim(), tokens);
      }),
    ];
  }

  /** A longhand of a value as written: its tokens' values in, and the var() it comes from when it is one. */
  #longhand(
    property: string,
    kind: LonghandKind,
    written: string,
    tokens: Tokens,
  ): Longhand {
    const value = this.#vars.resolved(written, tokens);
    const token = this.#vars.token(written) !== null && value !== written.trim();

    return { property, kind, value, design: value, ...(token ? { from: written.trim() } : {}) };
  }

  /** A value this check cannot read: said, not compared. */
  #unread(property: string, written: string): Longhand {
    return { property, kind: LONGHAND_KIND.unread, value: written, design: written };
  }

  /** A box shorthand of 1 to 4 lengths, top (or top left) first and clockwise. */
  #sides(shorthand: string, properties: readonly string[]): Expander {
    return (written, tokens) => {
      const parts = this.#split.split(written, CSS_SEPARATOR.space);
      const [top, right = top, bottom = top, left = right] = parts;

      if (top === undefined || right === undefined || bottom === undefined || left === undefined) {
        return [this.#unread(shorthand, written)];
      }

      return parts.length > SIDES.length
        ? [this.#unread(shorthand, written)]
        : [top, right, bottom, left].map((part, index) =>
          this.#longhand(properties[index] ?? shorthand, LONGHAND_KIND.length, part, tokens),
        );
    };
  }

  /** A shorthand of one or two values, the second the first when left out. */
  #pair(
    shorthand: string,
    [first, second]: readonly [string, string],
    kind: LonghandKind,
  ): Expander {
    return (written, tokens) => {
      const [one, two = one, ...rest] = this.#split.split(written, CSS_SEPARATOR.space);

      return one === undefined || two === undefined || rest.length > 0
        ? [this.#unread(shorthand, written)]
        : [this.#longhand(first, kind, one, tokens), this.#longhand(second, kind, two, tokens)];
    };
  }

  /** A border side's or an outline's words: its width, its style and its colour, in any order CSS allows. */
  #strokeWords(prefix: string): WordClass[] {
    return [
      {
        property: BUILD_STYLES_TEXT.strokeWidth(prefix),
        kind: LONGHAND_KIND.length,
        fits: (value) => Dimension.parse(value)?.isLength() ?? false,
      },
      {
        property: BUILD_STYLES_TEXT.strokeStyle(prefix),
        kind: LONGHAND_KIND.keyword,
        fits: (value) => BORDER_STYLES.includes(value),
      },
      { property: BUILD_STYLES_TEXT.strokeColor(prefix), kind: LONGHAND_KIND.color, fits: () => true },
    ];
  }

  #decorationWords(): WordClass[] {
    return [
      {
        property: LONGHAND.decorationLine,
        kind: LONGHAND_KIND.keyword,
        fits: (value) => DECORATION_LINES.includes(value),
      },
      {
        property: LONGHAND.decorationStyle,
        kind: LONGHAND_KIND.keyword,
        fits: (value) => DECORATION_STYLES.includes(value),
      },
      { property: LONGHAND.decorationColor, kind: LONGHAND_KIND.color, fits: () => true },
    ];
  }

  /** A shorthand's words sorted into its longhands: each to the first class its value fits, the last taking the rest. */
  #sorted(
    written: string,
    tokens: Tokens,
    classes: readonly WordClass[],
  ): Longhand[] {
    const words = classes.map((): string[] => []);

    for (const word of this.#split.split(written, CSS_SEPARATOR.space)) {
      const value = this.#vars.resolved(word, tokens).toLowerCase();
      const index = classes.findIndex(({ fits }) => fits(value));

      words[index === -1 ? classes.length - 1 : index]?.push(word);
    }

    return classes.flatMap(({ property, kind }, index) => {
      const given = words[index] ?? [];

      return given.length === 0 ? [] : [this.#longhand(property, kind, given.join(CSS_SEPARATOR.space), tokens)];
    });
  }

  /** A background's colour (only its last layer can be one) and its images, gradients and files, top first. */
  #background(written: string, tokens: Tokens): Longhand[] {
    const layers = this.#split.split(written, CSS_SEPARATOR.comma);
    const last = layers.at(-1);
    const isImage =
      last === undefined || BUILD_STYLES_PATTERN.imageLayer.test(this.#vars.resolved(last, tokens).trim());
    const images = isImage ? layers : layers.slice(0, -1);
    const joint = `${CSS_SEPARATOR.comma}${CSS_SEPARATOR.space}`;

    return [
      ...(isImage ? [] : [this.#longhand(LONGHAND.backgroundColor, LONGHAND_KIND.color, last, tokens)]),
      ...(images.length === 0
        ? []
        : [this.#longhand(LONGHAND.backgroundImage, LONGHAND_KIND.images, images.join(joint), tokens)]),
    ];
  }

  /** design_read's font shorthand, `[italic] weight size/line-height 'Family'`, as the longhands it sets. */
  #font(written: string, tokens: Tokens): Longhand[] {
    const words = this.#split.split(this.#vars.resolved(written, tokens), CSS_SEPARATOR.space);
    const italic = words[0]?.toLowerCase() === BUILD_STYLES_WORD.italic;
    const [weight = "", sizes = "", ...family] = italic ? words.slice(1) : words;
    const [size = "", lineHeight = BUILD_STYLES_WORD.normal] = this.#split.split(sizes, CSS_SEPARATOR.slash);
    const amount = Dimension.parse(weight);
    const pixels = Dimension.parse(size);

    if (
      amount === null ||
      amount.number() === null ||
      pixels === null ||
      pixels.pixels() === null ||
      family.length === 0
    ) {
      return [this.#unread(CSS_PROPERTY.font, written)];
    }

    return [
      this.#longhand(
        LONGHAND.fontFamily,
        LONGHAND_KIND.family,
        family.join(CSS_SEPARATOR.space).replace(BUILD_STYLES_PATTERN.quotes, ""),
        tokens,
      ),
      this.#longhand(LONGHAND.fontSize, LONGHAND_KIND.length, size, tokens),
      this.#longhand(LONGHAND.fontWeight, LONGHAND_KIND.number, weight, tokens),
      this.#longhand(
        LONGHAND.fontStyle,
        LONGHAND_KIND.keyword,
        italic ? BUILD_STYLES_WORD.italic : BUILD_STYLES_WORD.normal,
        tokens,
      ),
      this.#longhand(LONGHAND.lineHeight, LONGHAND_KIND.length, lineHeight, tokens),
    ];
  }

  /** flex as the grow it gives: how a layer fills its parent's axis. */
  #flex(written: string, tokens: Tokens): Longhand[] {
    const value = this.#vars.resolved(written, tokens).trim().toLowerCase();
    const [first = ""] = this.#split.split(value, CSS_SEPARATOR.space);
    const grow = FLEX_GROWS[value] ?? first;

    return [
      typeof Dimension.parse(grow)?.number() === "number"
        ? this.#longhand(LONGHAND.flexGrow, LONGHAND_KIND.number, grow, tokens)
        : this.#unread(CSS_PROPERTY.flex, written),
    ];
  }
}

export const SHORTHANDS = new InjectionToken<Shorthands>("Shorthands");
