import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  BUILD_STYLES_NUMBER,
  BUILD_STYLES_WORD,
  LONGHAND_KIND,
  SYNONYMS,
} from "@/core/checks/build-styles/build-styles.constants.ts";
import type { Longhand, LonghandKind } from "@/core/checks/build-styles/build-styles.types.ts";
import { Dimension } from "@/core/checks/build-styles/dimension.ts";
import { SHAPE_MATCH } from "@/core/checks/build-styles/shape-match.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";

/** How one kind of value is compared. */
interface Comparison {
  /** Whether a design value can be held against a computed one; any can when this is not given. */
  readonly comparable?: (design: string) => boolean;
  readonly same: (longhand: Longhand, build: string, tolerance: number) => boolean;
}

/**
 * A design longhand against a computed value, by its kind (K-049, K-050): sizes and places within the tolerance,
 * other lengths in one unit within float noise, colours by value, keywords with their synonyms, the first font family,
 * weights' names as numbers; what a computed style holds only in px (a percent or calc() offset, an auto size, fr
 * tracks, em without a size) is not comparable.
 */
@injectable()
export class StyleMatch {
  readonly #split;
  readonly #shapes;
  readonly #comparisons: Readonly<Record<LonghandKind, Comparison>> = {
    [LONGHAND_KIND.box]: {
      // A computed size or place is in px (a max may be none): a percent, calc() or auto is not one to hold it against.
      comparable: (design) => this.#pixels(design) !== null || this.#shapes.words(design) === BUILD_STYLES_WORD.none,
      same: (
        longhand,
        build,
        tolerance,
      ) => this.#sameBox(longhand, build, tolerance),
    },
    [LONGHAND_KIND.length]: {
      comparable: (design) => Dimension.parse(design)?.unit !== BUILD_STYLES_WORD.em,
      same: ({ property, value }, build) => this.#sameLength(property, value, build),
    },
    [LONGHAND_KIND.color]: { same: ({ value }, build) => this.#sameColor(value, build) },
    [LONGHAND_KIND.keyword]: { same: ({ property, value }, build) => this.#sameKeyword(property, value, build) },
    [LONGHAND_KIND.family]: { same: ({ value }, build) => this.#family(value) === this.#family(build) },
    [LONGHAND_KIND.number]: {
      same: ({ value }, build) =>
        this.#near(this.#amount(value), this.#amount(build), BUILD_STYLES_NUMBER.numberPrecision),
    },
    [LONGHAND_KIND.shadows]: { same: ({ value }, build) => this.#shapes.sameShadows(value, build) },
    [LONGHAND_KIND.images]: { same: ({ value }, build) => this.#shapes.sameImages(value, build) },
    [LONGHAND_KIND.transform]: { same: ({ value }, build) => this.#shapes.sameTransform(value, build) },
    [LONGHAND_KIND.tracks]: {
      // A computed grid holds its tracks in px: fr, repeat() and minmax() are not to hold them against.
      comparable: (design) =>
        this.#split.split(design, CSS_SEPARATOR.space).every((track) => this.#pixels(track) !== null),
      same: (
        longhand,
        build,
        tolerance,
      ) => this.#sameTracks(longhand, build, tolerance),
    },
    [LONGHAND_KIND.unread]: { comparable: () => false, same: () => false },
  };

  constructor(split = inject(CSS_SPLIT), shapes = inject(SHAPE_MATCH)) {
    this.#split = split;
    this.#shapes = shapes;
  }

  comparable(longhand: Longhand): boolean {
    return this.#comparisons[longhand.kind].comparable?.(longhand.value) ?? true;
  }

  same(
    longhand: Longhand,
    build: string,
    tolerance: number,
  ): boolean {
    return this.#comparisons[longhand.kind].same(longhand, build, tolerance);
  }

  /** A size or a place within the tolerance, which layout rounds; a keyword (none, auto) as a keyword. */
  #sameBox(
    { property, value }: Longhand,
    build: string,
    tolerance: number,
  ): boolean {
    const [mine, theirs] = [this.#pixels(value), this.#pixels(build)];

    return mine === null || theirs === null
      ? this.#sameKeyword(property, value, build)
      : Math.abs(mine - theirs) <= tolerance;
  }

  /** Lengths in one unit, within float noise; keywords (normal, auto) as keywords. */
  #sameLength(
    property: string,
    value: string,
    build: string,
  ): boolean {
    const [mine, theirs] = [Dimension.parse(value), Dimension.parse(build)];

    return mine === null || theirs === null
      ? this.#sameKeyword(property, value, build)
      : mine.near(theirs, BUILD_STYLES_NUMBER.lengthPrecision);
  }

  #sameColor(value: string, build: string): boolean {
    const [mine, theirs] = [this.#shapes.color(value), this.#shapes.color(build)];

    return mine === null || theirs === null
      ? this.#shapes.words(value) === this.#shapes.words(build)
      : mine.equals(theirs, BUILD_STYLES_NUMBER.colorPrecision);
  }

  #sameKeyword(
    property: string,
    value: string,
    build: string,
  ): boolean {
    const [mine, theirs] = [this.#shapes.words(value), this.#shapes.words(build)];

    return mine === theirs || (SYNONYMS[property] ?? []).some((same) => same.includes(mine) && same.includes(theirs));
  }

  /** Grid tracks in px, each within the tolerance: layout sizes them. */
  #sameTracks(
    { value }: Longhand,
    build: string,
    tolerance: number,
  ): boolean {
    const mine = this.#split.split(value, CSS_SEPARATOR.space).map((track) => this.#pixels(track));
    const theirs = this.#split.split(build, CSS_SEPARATOR.space).map((track) => this.#pixels(track));

    return (
      mine.length === theirs.length && mine.every((track, index) => this.#near(track, theirs[index] ?? null, tolerance))
    );
  }

  /** The first family of a font-family list, as compared. */
  #family(value: string): string {
    return this.#shapes.words(this.#split.split(value, CSS_SEPARATOR.comma)[0] ?? "");
  }

  /** A number; a font weight's names as their numbers. */
  #amount(value: string): number | null {
    const word = value.trim().toLowerCase();

    if (word === BUILD_STYLES_WORD.normal || word === BUILD_STYLES_WORD.bold) {
      return word === BUILD_STYLES_WORD.bold ? BUILD_STYLES_NUMBER.boldWeight : BUILD_STYLES_NUMBER.normalWeight;
    }

    return Dimension.parse(word)?.number() ?? null;
  }

  #near(
    mine: number | null,
    theirs: number | null,
    precision: number,
  ): boolean {
    return mine !== null && theirs !== null && Math.abs(mine - theirs) <= precision;
  }

  /** A length in px, a bare 0 as one; null for any other value. */
  #pixels(value: string): number | null {
    return Dimension.parse(value)?.pixels() ?? null;
  }
}

export const STYLE_MATCH = new InjectionToken<StyleMatch>("StyleMatch");
