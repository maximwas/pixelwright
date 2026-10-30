import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  BUILD_STYLES_NUMBER,
  BUILD_STYLES_PATTERN,
  BUILD_STYLES_WORD,
  TRANSFORM,
  TRANSFORM_FUNCTION,
} from "@/core/checks/build-styles/build-styles.constants.ts";
import { Dimension } from "@/core/checks/build-styles/dimension.ts";
import { GRADIENT_PARSER } from "@/core/css/gradients/gradient-parser.ts";
import { ANGLE_UNITS } from "@/core/css/gradients/gradients.constants.ts";
import type { GradientSpec, GradientStopSpec } from "@/core/css/gradients/gradients.types.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_URL } from "@/core/css/values/css-url.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { Color } from "@/core/kernel/color/color.ts";

/** A shadow by its parts: inset or not, x, y, blur and spread in px, and its colour. */
interface Shadow {
  readonly inset: boolean;
  readonly lengths: readonly number[];
  readonly color: Color | null;
}

/** A transform's 2D part as [a, b, c, d]. */
type Matrix = readonly number[];

/**
 * Values compared by their shape (K-049): colours (color-mix() with transparent too), shadow lists part by part in any
 * word order, background images layer by layer (gradients by geometry and stops, any url() as any url(), since a
 * build's file names are its own), transforms as the 2D matrix a computed style holds, their translation aside.
 */
@injectable()
export class ShapeMatch {
  readonly #split;
  readonly #gradients;
  readonly #urls;
  readonly #functions: Readonly<Record<string, (args: readonly string[]) => Matrix | null>> = {
    [TRANSFORM_FUNCTION.matrix]: (args) => this.#entries(args, TRANSFORM.matrix),
    [TRANSFORM_FUNCTION.matrix3d]: (args) => this.#entries(args, TRANSFORM.matrix3d),
    [TRANSFORM_FUNCTION.rotate]: ([angle = ""]) => this.#turn(angle),
    [TRANSFORM_FUNCTION.rotateZ]: ([angle = ""]) => this.#turn(angle),
    [TRANSFORM_FUNCTION.scale]: ([x = "", y = x]) => this.#scale(Number(x), Number(y)),
    [TRANSFORM_FUNCTION.scaleX]: ([x = ""]) => this.#scale(Number(x), TRANSFORM.one),
    [TRANSFORM_FUNCTION.scaleY]: ([y = ""]) => this.#scale(TRANSFORM.one, Number(y)),
    [TRANSFORM_FUNCTION.translate]: () => TRANSFORM.identity,
    [TRANSFORM_FUNCTION.translateX]: () => TRANSFORM.identity,
    [TRANSFORM_FUNCTION.translateY]: () => TRANSFORM.identity,
    [TRANSFORM_FUNCTION.translate3d]: () => TRANSFORM.identity,
  };

  constructor(
    split = inject(CSS_SPLIT),
    gradients = inject(GRADIENT_PARSER),
    urls = inject(CSS_URL),
  ) {
    this.#split = split;
    this.#gradients = gradients;
    this.#urls = urls;
  }

  /** A value's words as compared: lower case, one space between them, no quotes. */
  words(value: string): string {
    return value
      .trim()
      .replace(BUILD_STYLES_PATTERN.spaces, CSS_SEPARATOR.space)
      .replace(BUILD_STYLES_PATTERN.quotes, "")
      .toLowerCase();
  }

  /** A CSS colour, or one mixed with transparent at a percent (how design_read writes a token at an opacity). */
  color(value: string): Color | null {
    const mixed = BUILD_STYLES_PATTERN.mixed.exec(value.trim());
    const color = Color.parse(mixed?.[1] ?? value);

    return mixed === null || color === null ? color : color.faded(Number(mixed[2]) / BUILD_STYLES_NUMBER.percent);
  }

  /** Shadow lists alike shadow by shadow, whatever order each one's words are in; none as no shadow. */
  sameShadows(value: string, build: string): boolean {
    const [mine, theirs] = [this.#shadows(value), this.#shadows(build)];

    if (mine === null || theirs === null) {
      return this.words(value) === this.words(build);
    }

    return mine.length === theirs.length && mine.every((shadow, index) => this.#sameShadow(shadow, theirs[index]));
  }

  /** Background images alike layer by layer: gradients by their geometry and stops, files by being files. */
  sameImages(value: string, build: string): boolean {
    const mine = this.#split.split(value, CSS_SEPARATOR.comma);
    const theirs = this.words(build) === BUILD_STYLES_WORD.none ? [] : this.#split.split(build, CSS_SEPARATOR.comma);

    return mine.length === theirs.length && mine.every((layer, index) => this.#sameImage(layer, theirs[index] ?? ""));
  }

  /** Transforms alike as the matrices they make (a computed style holds a matrix), their translation aside. */
  sameTransform(value: string, build: string): boolean {
    const [mine, theirs] = [this.#matrix(value), this.#matrix(build)];

    return mine === null || theirs === null
      ? this.words(value) === this.words(build)
      : this.#near(mine, theirs, BUILD_STYLES_NUMBER.matrixPrecision);
  }

  /** A shadow list; null when a shadow in it reads as none. */
  #shadows(value: string): Shadow[] | null {
    if (this.words(value) === BUILD_STYLES_WORD.none) {
      return [];
    }

    const shadows = this.#split.split(value, CSS_SEPARATOR.comma).map((part) => this.#shadow(part));

    return shadows.every((shadow): shadow is Shadow => shadow !== null) ? shadows : null;
  }

  /** One shadow's words in any order: inset, 2 to 4 lengths in px, and its colour. */
  #shadow(part: string): Shadow | null {
    const lengths: number[] = [];
    const colour: string[] = [];
    let inset = false;

    for (const word of this.#split.split(part, CSS_SEPARATOR.space)) {
      const length = Dimension.parse(word);

      if (word.toLowerCase() === BUILD_STYLES_WORD.inset) {
        inset = true;
      } else if (length === null) {
        colour.push(word);
      } else {
        lengths.push(length.pixels() ?? Number.NaN);
      }
    }

    const color = colour.length === 0 ? null : this.color(colour.join(CSS_SEPARATOR.space));
    const read =
      lengths.length >= BUILD_STYLES_NUMBER.shadowLengths &&
      lengths.length <= BUILD_STYLES_NUMBER.shadowAllLengths &&
      lengths.every((length) => Number.isFinite(length)) &&
      (colour.length === 0 || color !== null);

    return read
      ? {
        inset,
        lengths: Array.from({ length: BUILD_STYLES_NUMBER.shadowAllLengths }, (_empty, index) => lengths[index] ?? 0),
        color,
      }
      : null;
  }

  #sameShadow(mine: Shadow, theirs: Shadow | undefined): boolean {
    return (
      theirs !== undefined &&
      mine.inset === theirs.inset &&
      this.#near(mine.lengths, theirs.lengths, BUILD_STYLES_NUMBER.lengthPrecision) &&
      this.#sameColor(mine.color, theirs.color)
    );
  }

  #sameColor(mine: Color | null, theirs: Color | null): boolean {
    return mine === null || theirs === null ? mine === theirs : mine.equals(theirs, BUILD_STYLES_NUMBER.colorPrecision);
  }

  #sameImage(mine: string, theirs: string): boolean {
    const [gradient, built] = [this.#gradients.parse(mine), this.#gradients.parse(theirs)];

    if (gradient !== null && built !== null) {
      return this.#sameGradient(gradient, built);
    }

    // A file's name and folder are the build's own: a file is one for a file.
    return (
      (this.#urls.image(mine) !== null && this.#urls.image(theirs) !== null) || this.words(mine) === this.words(theirs)
    );
  }

  #sameGradient(mine: GradientSpec, theirs: GradientSpec): boolean {
    const { stops: myStops, ...myShape } = mine;
    const { stops: theirStops, ...theirShape } = theirs;

    return (
      this.#near(myShape, theirShape, BUILD_STYLES_NUMBER.geometryPrecision) &&
      myStops.length === theirStops.length &&
      myStops.every((stop, index) => this.#sameStop(stop, theirStops[index]))
    );
  }

  #sameStop(mine: GradientStopSpec, theirs: GradientStopSpec | undefined): boolean {
    if (theirs === undefined || Math.abs(mine.position - theirs.position) > BUILD_STYLES_NUMBER.stopPrecision) {
      return false;
    }

    return mine.color === null || theirs.color === null
      ? mine.token === theirs.token
      : this.#sameColor(Color.of(mine.color, mine.color.space), Color.of(theirs.color, theirs.color.space));
  }

  /** Numbers within `precision`, in arrays and objects key by key; anything else as itself. */
  #near(
    mine: unknown,
    theirs: unknown,
    precision: number,
  ): boolean {
    if (typeof mine === "number" && typeof theirs === "number") {
      return Math.abs(mine - theirs) <= precision;
    }

    if (typeof mine !== "object" || mine === null || typeof theirs !== "object" || theirs === null) {
      return mine === theirs;
    }

    const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);

    return [...keys].every((key) => this.#near(Reflect.get(mine, key), Reflect.get(theirs, key), precision));
  }

  /** A transform's 2D matrix: none, a computed matrix() or matrix3d(), or functions such as rotate() and scaleX(-1). */
  #matrix(value: string): Matrix | null {
    if (this.words(value) === BUILD_STYLES_WORD.none) {
      return TRANSFORM.identity;
    }

    return this.#split.split(value, CSS_SEPARATOR.space).reduce<Matrix | null>((matrix, part) => {
      const match = BUILD_STYLES_PATTERN.function.exec(part.trim());
      const read = this.#functions[(match?.[1] ?? "").toLowerCase()];
      const next = read === undefined ? null : read(this.#split.split(match?.[2] ?? "", CSS_SEPARATOR.comma));

      return matrix === null || next === null ? null : this.#times(matrix, next);
    }, TRANSFORM.identity);
  }

  #entries(args: readonly string[], picked: readonly number[]): Matrix | null {
    const entries = picked.map((at) => Number(args[at]));

    return entries.every((entry) => Number.isFinite(entry)) ? entries : null;
  }

  /** rotate(): clockwise, as CSS turns. */
  #turn(angle: string): Matrix | null {
    const parsed = Dimension.parse(angle);
    const degrees = parsed === null ? undefined : ANGLE_UNITS[parsed.unit];

    if (parsed === null || degrees === undefined) {
      return parsed?.value === 0 ? TRANSFORM.identity : null;
    }

    const radians = (parsed.value * degrees * Math.PI) / BUILD_STYLES_NUMBER.halfTurn;
    const [cos, sin] = [Math.cos(radians), Math.sin(radians)];

    return [cos, sin, -sin, cos];
  }

  #scale(x: number, y: number): Matrix | null {
    return Number.isFinite(x) && Number.isFinite(y) ? [x, 0, 0, y] : null;
  }

  /** One matrix then another, as CSS applies a transform's functions. */
  #times([a1 = 0, b1 = 0, c1 = 0, d1 = 0]: Matrix, [a2 = 0, b2 = 0, c2 = 0, d2 = 0]: Matrix): Matrix {
    return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2];
  }
}

export const SHAPE_MATCH = new InjectionToken<ShapeMatch>("ShapeMatch");
