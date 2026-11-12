import { Color } from "../../kernel/color/color.ts";
import type { GradientLength, GradientSpec, GradientStopSpec } from "../figma-props.ts";
import { degreesOf, dimensionOf, splitTop, tokenOf } from "./css-values.ts";
import { turn } from "./gradient-geometry.ts";

/** CSS's `to <side>` directions as angles; a corner as its diagonal on a square. */
const SIDES: Readonly<Record<string, number>> = {
  "to top": 0,
  "to top right": 45,
  "to right top": 45,
  "to right": 90,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom": 180,
  "to bottom left": 225,
  "to left bottom": 225,
  "to left": 270,
  "to top left": 315,
  "to left top": 315,
};

/** Position keywords as percents of the box. */
const PLACES: Readonly<Record<string, number>> = {
  left: 0,
  top: 0,
  center: 50,
  right: 100,
  bottom: 100,
};

const CENTRE: { readonly x: GradientLength; readonly y: GradientLength } = {
  x: {
    value: 50,
    unit: "%",
  },
  y: {
    value: 50,
    unit: "%",
  },
};

/** A stop as CSS writes it, its place given or not. */
type ParsedStop = Omit<GradientStopSpec, "position"> & { readonly position: number | null };

/**
 * A CSS linear-, radial- or conic-gradient as a gradient Figma can paint: its angle, centre and radii, and its stops
 * (colours, tokens, `transparent`), those without a place spread evenly between their neighbours as CSS spreads them.
 * Null for anything else (a repeating gradient, a size keyword it cannot place, a stop it cannot read).
 */
export function gradientOf(value: string): GradientSpec | null {
  const match = /^(linear|radial|conic)-gradient\(([\s\S]*)\)$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const parts = splitTop(match[2] ?? "", ",").map((part) => part.trim());
  const [first = "", ...rest] = parts;
  const leads = stopOf(first) === null;
  const stops = placed((leads ? rest : parts).map(stopOf));

  if (stops === null) {
    return null;
  }

  if (match[1] === "linear") {
    const angle = leads ? angleOf(first) : 180;

    return angle === null
      ? null
      : {
          kind: "gradient",
          type: "LINEAR",
          angle,
          stops,
        };
  }

  return match[1] === "radial" ? radialOf(leads ? first : "", stops) : conicOf(leads ? first : "", stops);
}

function radialOf(prelude: string, stops: GradientStopSpec[]): GradientSpec | null {
  const [shape = "", place = ""] = prelude.split(/\bat\b/).map((part) => part.trim());
  const sizes = shape
    .split(/\s+/)
    .filter((word) => word !== "" && word !== "ellipse" && word !== "circle")
    .map(lengthOf);
  const center = place === "" ? CENTRE : centreOf(place);

  if (center === null || sizes.includes(null) || sizes.length > 2) {
    return null;
  }

  const [x, y] = sizes as GradientLength[];

  return {
    kind: "gradient",
    type: "RADIAL",
    center,
    radii:
      x === undefined
        ? null
        : {
            x,
            y: y ?? x,
          },
    stops,
  };
}

function conicOf(prelude: string, stops: GradientStopSpec[]): GradientSpec | null {
  const from = /\bfrom\s+(\S+)/.exec(prelude)?.[1];
  const place = /\bat\s+(.+)$/.exec(prelude)?.[1];
  const angle = from === undefined ? 0 : angleOf(from);
  const center = place === undefined ? CENTRE : centreOf(place);

  return angle === null || center === null
    ? null
    : {
        kind: "gradient",
        type: "ANGULAR",
        angle,
        center,
        stops,
      };
}

/** An angle (deg, grad, rad, turn) or a `to <side>` direction. */
function angleOf(value: string): number | null {
  const side = SIDES[value.trim().replace(/\s+/g, " ")];
  const degrees = side ?? degreesOf(value);

  return degrees === null ? null : turn(degrees);
}

/** `x y` as lengths, from percents, px or keywords. */
function centreOf(value: string): { x: GradientLength; y: GradientLength } | null {
  const [x, y = "center"] = value.trim().split(/\s+/);
  const [left, top] = [lengthOf(x ?? ""), lengthOf(y)];

  return left === null || top === null
    ? null
    : {
        x: left,
        y: top,
      };
}

/** A length of a centre or a radius: px, a percent, a 0, or a place keyword as its percent. */
function lengthOf(value: string): GradientLength | null {
  const keyword = PLACES[value];
  const length = dimensionOf(value);

  if (keyword !== undefined) {
    return {
      value: keyword,
      unit: "%",
    };
  }

  if (length === null || !(length.unit === "px" || length.unit === "%" || (length.unit === "" && length.value === 0))) {
    return null;
  }

  return {
    value: length.value,
    unit: length.unit === "%" ? "%" : "px",
  };
}

/** A stop's place along the gradient, 0 to 1: a percent, or an angle of a conic's turn; null for anything else. */
function placeOf(word: string): number | null {
  const place = dimensionOf(word);

  if (place?.unit === "%") {
    return place.value / 100;
  }

  const degrees = degreesOf(word);

  return degrees === null ? null : degrees / 360;
}

/** A stop: a colour or a token, then its place in percent (a conic's as an angle too); null when it is no stop. */
function stopOf(part: string): ParsedStop | null {
  const words = splitTop(part, " ");
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const position = last === undefined ? null : placeOf(last);
  const color = (position === null ? words : words.slice(0, -1)).join(" ");
  const token = tokenOf(color);

  if (token !== null) {
    return {
      color: null,
      token: token.token,
      position,
    };
  }

  const parsed = Color.parse(color);

  return parsed === null || (last !== undefined && position === null)
    ? null
    : {
        color: parsed.value(),
        position,
      };
}

/** Stops with every place: the first at 0, the last at 1, the rest spread evenly between their placed neighbours. */
function placed(stops: readonly (ParsedStop | null)[]): GradientStopSpec[] | null {
  if (stops.length < 2 || stops.includes(null)) {
    return null;
  }

  const places = (stops as ParsedStop[]).map(
    ({ position }, index, all) => position ?? (index === 0 ? 0 : index === all.length - 1 ? 1 : null),
  );

  for (let index = 1; index < places.length; index++) {
    if (places[index] === null) {
      const next = places.findIndex((place, at) => at > index && place !== null);
      const [from, to] = [places[index - 1] ?? 0, places[next] ?? 1];

      places[index] = from + (to - from) / (next - index + 1);
    }
  }

  return (stops as ParsedStop[]).map((stop, index) => ({
    ...stop,
    position: places[index] ?? 0,
  }));
}
