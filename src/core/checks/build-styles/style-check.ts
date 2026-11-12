import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  BUILD_STYLES_PATTERN,
  BUILD_STYLES_TEXT,
  BUILD_STYLES_WORD,
  FLEX_WORDS,
  LONGHAND,
  LONGHAND_KIND,
} from "@/core/checks/build-styles/build-styles.constants.ts";
import type { StyleComparison } from "@/core/checks/build-styles/build-styles.schema.ts";
import type { Longhand, StyleLayer } from "@/core/checks/build-styles/build-styles.types.ts";
import { Dimension } from "@/core/checks/build-styles/dimension.ts";
import { SHORTHANDS } from "@/core/checks/build-styles/shorthands.ts";
import { STYLE_MATCH } from "@/core/checks/build-styles/style-match.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { CssDeclaration } from "@/core/css/registry/css-declarations.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";

/**
 * A build's computed styles for one layer against the design's (K-047): each property the layer's CSS sets (shorthands
 * spread into longhands, tokens and its text style in) is the same, different, left out by the build, or written in a
 * way a computed style cannot be held against. A size or a place may be off by `tolerance` px, since layout rounds it;
 * other lengths, colours and numbers compare as CSS computes them. Only what the design sets is checked.
 */
@injectable()
export class StyleCheck {
  readonly #shorthands;
  readonly #match;

  constructor(shorthands = inject(SHORTHANDS), match = inject(STYLE_MATCH)) {
    this.#shorthands = shorthands;
    this.#match = match;
  }

  compare(
    layer: StyleLayer,
    built: Readonly<Record<string, string>>,
    tolerance: number,
  ): StyleComparison {
    const given = this.#computed(built);
    const result: StyleComparison = { matched: 0, mismatches: [], notGiven: [], notCompared: [] };

    for (const longhand of this.#longhands(layer)) {
      const { property, design, from } = longhand;
      const build = given.get(property);

      if (!this.#match.comparable(longhand)) {
        result.notCompared.push({ property, design });
      } else if (build === undefined) {
        result.notGiven.push(property);
      } else if (this.#match.same(longhand, build, tolerance)) {
        result.matched += 1;
      } else {
        result.mismatches.push({ property, design, ...(from === undefined ? {} : { from }), build });
      }
    }

    return result;
  }

  /**
   * The computed properties the layer sets in its CSS's order: its text style's first and its own over them, as CSS
   * cascades them; a length in em at the font's size in px.
   */
  #longhands({ declarations, textStyle, tokens, textStyles }: StyleLayer): Longhand[] {
    const longhands = new Map<string, Longhand>();
    const cross = this.#crossGap(declarations);
    const style =
      textStyle === undefined
        ? []
        : this.#shorthands
          .textStyle(textStyles[textStyle] ?? "", tokens)
          .map((longhand) => ({ ...longhand, from: longhand.from ?? BUILD_STYLES_TEXT.fromStyle(textStyle) }));
    const own = declarations.flatMap(([name, written]) => this.#shorthands.longhands(name, written, tokens));

    for (const longhand of [...style, ...own]) {
      // An own value over its style's keeps the style's place in the list.
      if (longhand.property !== cross) {
        longhands.set(longhand.property, longhand);
      }
    }

    return this.#inPixels([...longhands.values()]);
  }

  /** A flex that does not wrap lays out one line: its one gap shows on its main axis only, so the other is not its. */
  #crossGap(declarations: readonly CssDeclaration[]): string | undefined {
    const css = new Map(declarations);
    const gap = css.get(CSS_PROPERTY.gap);
    const oneLine =
      FLEX_WORDS.displays.includes(css.get(CSS_PROPERTY.display) ?? "") &&
      !FLEX_WORDS.wraps.includes(css.get(CSS_PROPERTY.flexWrap) ?? "");

    if (!oneLine || gap === undefined || gap.trim().includes(CSS_SEPARATOR.space)) {
      return undefined;
    }

    return FLEX_WORDS.columns.includes(css.get(CSS_PROPERTY.flexDirection) ?? "")
      ? CSS_PROPERTY.columnGap
      : CSS_PROPERTY.rowGap;
  }

  /** Lengths in em at the font's size in px, as a computed style holds them; without a size in px they stay em. */
  #inPixels(longhands: readonly Longhand[]): Longhand[] {
    const size = longhands.find(({ property }) => property === LONGHAND.fontSize)?.value ?? "";
    const pixels = Dimension.parse(size)?.pixels() ?? null;

    return longhands.map((longhand) => {
      const length = longhand.kind === LONGHAND_KIND.length ? Dimension.parse(longhand.value) : null;

      return length?.unit === BUILD_STYLES_WORD.em && pixels !== null
        ? { ...longhand, value: BUILD_STYLES_TEXT.px(length.value * pixels) }
        : longhand;
    });
  }

  /** The build's styles by property as CSS spells them: backgroundColor, as a style object has it, is background-color. */
  #computed(built: Readonly<Record<string, string>>): Map<string, string> {
    return new Map(
      Object.entries(built).map(([name, value]) => [
        name.startsWith(BUILD_STYLES_WORD.custom)
          ? name
          : name.replace(BUILD_STYLES_PATTERN.capital, (capital) => BUILD_STYLES_TEXT.kebab(capital)),
        value.trim(),
      ]),
    );
  }
}

export const STYLE_CHECK = new InjectionToken<StyleCheck>("StyleCheck");
