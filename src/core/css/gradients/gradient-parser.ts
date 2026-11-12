import { isTokenDimension, isTokenEOF, isTokenNumber, isTokenPercentage, tokenize } from "@csstools/css-tokenizer";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { GRADIENT_GEOMETRY } from "@/core/css/gradients/gradient-geometry.ts";
import {
  ANGLE_UNITS,
  GRADIENT_CENTRE,
  GRADIENT_KIND,
  GRADIENT_NUMBER,
  GRADIENT_PATTERN,
  GRADIENT_PLACES,
  GRADIENT_SIDES,
  GRADIENT_UNIT,
  GRADIENT_VALUE,
} from "@/core/css/gradients/gradients.constants.ts";
import type {
  GradientLength,
  GradientPoint,
  GradientSpec,
  GradientStopSpec,
} from "@/core/css/gradients/gradients.types.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_VAR } from "@/core/css/values/css-var.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { Color } from "@/core/kernel/color/color.ts";

/** A stop as CSS writes it, its place given or not. */
type ParsedStop = Omit<GradientStopSpec, "position"> & { readonly position: number | null };

/** A number, a percentage or a dimension as the CSS tokenizer reads it; the unit "" for a plain number. */
interface Dimension {
  readonly value: number;
  readonly unit: string;
}

/**
 * A CSS linear-, radial- or conic-gradient as a gradient Figma can paint (C-086): its angle, centre and radii, and its
 * stops (colours, P3 colours, tokens, `color-mix()` with transparent), those without a place spread evenly between
 * their neighbours as CSS spreads them. Own code: the gradient-parser library failed on radial sizes, color-mix and P3.
 */
@injectable()
export class GradientParser {
  readonly #split;
  readonly #vars;
  readonly #geometry;

  constructor(
    split = inject(CSS_SPLIT),
    vars = inject(CSS_VAR),
    geometry = inject(GRADIENT_GEOMETRY),
  ) {
    this.#split = split;
    this.#vars = vars;
    this.#geometry = geometry;
  }

  /** The gradient; null for anything else (a repeating gradient, a size keyword, a stop it cannot read). */
  parse(value: string): GradientSpec | null {
    const match = GRADIENT_PATTERN.gradient.exec(value.trim());

    if (match === null) {
      return null;
    }

    const parts = this.#split.split(match[2] ?? "", CSS_SEPARATOR.comma);
    const [first = "", ...rest] = parts;
    const leads = this.#stop(first) === null;
    const stops = this.#placed((leads ? rest : parts).map((part) => this.#stop(part)));
    const prelude = leads ? first : "";

    if (stops === null) {
      return null;
    }

    if (match[1] === GRADIENT_VALUE.linear) {
      const angle = leads ? this.#angle(first) : GRADIENT_NUMBER.defaultLinear;

      return angle === null ? null : { type: GRADIENT_KIND.linear, angle, stops };
    }

    return match[1] === GRADIENT_VALUE.radial ? this.#radial(prelude, stops) : this.#conic(prelude, stops);
  }

  /** `[circle | ellipse] [rx [ry]] [at x y]`; a size keyword (closest-side …) is refused. */
  #radial(prelude: string, stops: GradientStopSpec[]): GradientSpec | null {
    const [shape = "", place = ""] = prelude.split(GRADIENT_PATTERN.at).map((part) => part.trim());
    const words = shape
      .split(GRADIENT_PATTERN.spaces)
      .filter((word) => word !== "" && word !== GRADIENT_VALUE.ellipse && word !== GRADIENT_VALUE.circle);
    const sizes = words.map((word) => this.#length(word)).filter((length): length is GradientLength => length !== null);
    const center = place === "" ? GRADIENT_CENTRE : this.#centre(place);
    const [x, y = x] = sizes;

    if (center === null || sizes.length !== words.length || sizes.length > 2) {
      return null;
    }

    return { type: GRADIENT_KIND.radial, center, radii: x === undefined || y === undefined ? null : { x, y }, stops };
  }

  /** `[from <angle>] [at x y]`. */
  #conic(prelude: string, stops: GradientStopSpec[]): GradientSpec | null {
    const from = GRADIENT_PATTERN.from.exec(prelude)?.[1];
    const place = GRADIENT_PATTERN.place.exec(prelude)?.[1];
    const angle = from === undefined ? 0 : this.#angle(from);
    const center = place === undefined ? GRADIENT_CENTRE : this.#centre(place);

    return angle === null || center === null ? null : { type: GRADIENT_KIND.angular, angle, center, stops };
  }

  /** An angle (deg, grad, rad, turn) or a `to <side>` direction, 0 to 360. */
  #angle(value: string): number | null {
    const side = GRADIENT_SIDES[value.trim().split(GRADIENT_PATTERN.spaces).join(GRADIENT_VALUE.space)];
    const degrees = side ?? this.#degrees(value);

    return degrees === null ? null : this.#geometry.turn(degrees);
  }

  /** `x y` as lengths, from percents, px or keywords; y is the centre when left out. */
  #centre(value: string): GradientPoint | null {
    const [x = "", y = GRADIENT_VALUE.center] = value.trim().split(GRADIENT_PATTERN.spaces);
    const [left, top] = [this.#length(x), this.#length(y)];

    return left === null || top === null ? null : { x: left, y: top };
  }

  /** A centre's or a radius's length: px, a percent, a bare 0, or a place keyword as its percent. */
  #length(value: string): GradientLength | null {
    const keyword = GRADIENT_PLACES[value];

    if (keyword !== undefined) {
      return { value: keyword, unit: GRADIENT_UNIT.percent };
    }

    const length = this.#dimension(value);

    if (length?.unit === GRADIENT_UNIT.px || length?.unit === GRADIENT_UNIT.percent) {
      return { value: length.value, unit: length.unit };
    }

    return length?.unit === "" && length.value === 0 ? { value: 0, unit: GRADIENT_UNIT.px } : null;
  }

  /** A stop: a colour or a token, then its place (a percent, or a conic's angle); null when it is no stop. */
  #stop(part: string): ParsedStop | null {
    const words = this.#split.split(part, CSS_SEPARATOR.space);
    const last = words.length > 1 ? words.at(-1) : undefined;
    const position = last === undefined ? null : this.#place(last);
    const colour = this.#colour((position === null ? words : words.slice(0, -1)).join(GRADIENT_VALUE.space));

    return colour === null || (last !== undefined && position === null) ? null : { ...colour, position };
  }

  /** A stop's colour: a token or a colour, either faded by `color-mix(… N%, transparent)` as design_read writes it. */
  #colour(value: string): Omit<GradientStopSpec, "position"> | null {
    const mix = GRADIENT_PATTERN.mix.exec(value.trim());
    const share = mix === null ? 1 : Number(mix[2]) / GRADIENT_NUMBER.percent;
    const inner = mix?.[1] ?? value;
    const token = this.#vars.token(inner);

    if (token !== null) {
      return share < 1 ? { color: null, token: token.token, opacity: share } : { color: null, token: token.token };
    }

    const color = Color.parse(inner);

    return color === null ? null : { color: color.faded(share).value() };
  }

  /** A stop's place along the gradient, 0 to 1: a percent, or an angle of a conic's turn. */
  #place(word: string): number | null {
    const place = this.#dimension(word);

    if (place?.unit === GRADIENT_UNIT.percent) {
      return place.value / GRADIENT_NUMBER.percent;
    }

    const degrees = this.#degrees(word);

    return degrees === null ? null : degrees / GRADIENT_NUMBER.fullTurn;
  }

  /** Stops with every place: the first at 0, the last at 1, the rest spread evenly between placed neighbours. */
  #placed(parsed: readonly (ParsedStop | null)[]): GradientStopSpec[] | null {
    const stops = parsed.filter((stop): stop is ParsedStop => stop !== null);

    if (stops.length < GRADIENT_NUMBER.minStops || stops.length !== parsed.length) {
      return null;
    }

    const last = stops.length - 1;
    const places = stops.map(
      ({ position }, index) => position ?? (index === 0 ? 0 : null) ?? (index === last ? 1 : null),
    );

    for (let index = 1; index < places.length; index++) {
      if (places[index] === null) {
        const next = places.findIndex((place, at) => at > index && place !== null);
        const [from, to] = [places[index - 1] ?? 0, places[next] ?? 1];

        places[index] = from + (to - from) / (next - index + 1);
      }
    }

    return stops.map((stop, index) => ({ ...stop, position: places[index] ?? 0 }));
  }

  #degrees(value: string): number | null {
    const angle = this.#dimension(value);
    const degrees = angle === null ? undefined : ANGLE_UNITS[angle.unit];

    return angle === null || degrees === undefined ? null : angle.value * degrees;
  }

  /** One number, percentage or dimension (unit in lower case); null for anything else, or more than one. */
  #dimension(value: string): Dimension | null {
    const tokens = tokenize({ css: value.trim() }).filter((token) => !isTokenEOF(token));
    const [token] = tokens;

    if (tokens.length !== 1 || token === undefined) {
      return null;
    }

    if (isTokenDimension(token)) {
      return { value: token[4].value, unit: token[4].unit.toLowerCase() };
    }

    if (isTokenPercentage(token)) {
      return { value: token[4].value, unit: GRADIENT_UNIT.percent };
    }

    return isTokenNumber(token) ? { value: token[4].value, unit: "" } : null;
  }
}

export const GRADIENT_PARSER = new InjectionToken<GradientParser>("GradientParser");
