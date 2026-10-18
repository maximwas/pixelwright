import type { EffectSpec, GradientSpec, GradientStopSpec } from "../../css-mapping/figma-props.ts";
import { splitTop, urlsOf } from "../../css-mapping/values/css-values.ts";
import { gradientOf } from "../../css-mapping/values/gradient-parse.ts";
import { attributeProps } from "../../css-mapping/write-element.ts";
import { Color } from "../../kernel/color/color.ts";
import { sameValue } from "../../kernel/equality.ts";
import { COLOR_PRECISION, LENGTH_PRECISION, wordsOf } from "./compared.ts";

type Shadow = Extract<EffectSpec, { readonly type: "DROP_SHADOW" | "INNER_SHADOW" }>;

/** A computed matrix holds 6 decimals. */
const MATRIX_PRECISION = 0.001;

/** How far a gradient's angle (in degrees) or centre may be off: design_read writes Figma's to hundredths. */
const GEOMETRY_PRECISION = 0.5;

/** How far a stop may be off, as a part of the gradient's length. */
const STOP_PRECISION = 0.005;

/** Shadow lists alike shadow by shadow, whatever order each one's words are in; none as no shadow. */
export function sameShadows(property: string, value: string, build: string): boolean {
  const [mine, theirs] = [shadowsOf(property, value), shadowsOf(property, build)];

  if (mine === null || theirs === null) {
    return wordsOf(value) === wordsOf(build);
  }

  return mine.length === theirs.length && mine.every((shadow, index) => sameShadow(shadow, theirs[index]));
}

/** Background images alike layer by layer: gradients by their geometry and stops, files by being files. */
export function sameImages(value: string, build: string): boolean {
  const mine = splitTop(value, ",");
  const theirs = wordsOf(build) === "none" ? [] : splitTop(build, ",");

  return mine.length === theirs.length && mine.every((layer, index) => sameImage(layer, theirs[index] ?? ""));
}

/** Transforms alike as the matrices they make (a computed style holds a matrix), their translation aside. */
export function sameTransform(value: string, build: string): boolean {
  const [mine, theirs] = [matrixOf(value), matrixOf(build)];

  return mine === null || theirs === null
    ? wordsOf(value) === wordsOf(build)
    : sameValue(mine, theirs, MATRIX_PRECISION);
}

/** A shadow list as design_apply reads one, its words in any order CSS allows; null when it reads none. */
function shadowsOf(property: string, value: string): Shadow[] | null {
  if (wordsOf(value) === "none") {
    return [];
  }

  const { props, errors } = attributeProps(property === "text-shadow" ? "Text" : "Frame", property, value);
  const { effects } = props;

  if (errors.length > 0 || effects === undefined || "token" in effects) {
    return null;
  }

  return effects.filter((effect): effect is Shadow => effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW");
}

function sameShadow(mine: Shadow, theirs: Shadow | undefined): boolean {
  return (
    theirs !== undefined &&
    mine.type === theirs.type &&
    sameValue(
      [mine.x, mine.y, mine.radius, mine.spread],
      [theirs.x, theirs.y, theirs.radius, theirs.spread],
      LENGTH_PRECISION,
    ) &&
    Color.fromValue(mine.color).equals(Color.fromValue(theirs.color), COLOR_PRECISION)
  );
}

function sameImage(mine: string, theirs: string): boolean {
  const [gradient, built] = [gradientOf(mine), gradientOf(theirs)];

  if (gradient !== null && built !== null) {
    return sameGradient(gradient, built);
  }

  // A file's name and folder are the build's own: a file is one for a file.
  return (urlsOf(mine).length > 0 && urlsOf(theirs).length > 0) || wordsOf(mine) === wordsOf(theirs);
}

function sameGradient(mine: GradientSpec, theirs: GradientSpec): boolean {
  const { stops: myStops, ...myShape } = mine;
  const { stops: theirStops, ...theirShape } = theirs;

  return (
    sameValue(myShape, theirShape, GEOMETRY_PRECISION) &&
    myStops.length === theirStops.length &&
    myStops.every((stop, index) => sameStop(stop, theirStops[index]))
  );
}

function sameStop(mine: GradientStopSpec, theirs: GradientStopSpec | undefined): boolean {
  if (theirs === undefined || Math.abs(mine.position - theirs.position) > STOP_PRECISION) {
    return false;
  }

  return mine.color === null || theirs.color === null
    ? mine.token === theirs.token
    : Color.fromValue(mine.color).equals(Color.fromValue(theirs.color), COLOR_PRECISION);
}

/**
 * A transform's 2D matrix without its translation, [a, b, c, d]: a computed matrix() or matrix3d(), or the rotate()
 * and scaleX(-1) design_read writes.
 */
function matrixOf(value: string): number[] | null {
  const css = /^matrix(3d)?\((.*)\)$/i.exec(value.trim());

  if (css === null) {
    return turnOf(value);
  }

  const numbers = splitTop(css[2] ?? "", ",").map(Number);
  const picked = css[1] === undefined ? numbers.slice(0, 4) : [0, 1, 4, 5].map((at) => numbers[at] ?? Number.NaN);

  return picked.length === 4 && picked.every((entry) => Number.isFinite(entry)) ? picked : null;
}

/** design_read's transform as a matrix: its turn, clockwise as CSS turns, then its mirror. */
function turnOf(value: string): number[] | null {
  if (wordsOf(value) === "none") {
    return [1, 0, 0, 1];
  }

  const { props, errors } = attributeProps("Frame", "transform", value);

  if (errors.length > 0 || props.rotation === undefined) {
    return null;
  }

  // Figma turns counter-clockwise.
  const radians = (-props.rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];

  return props.mirror ? [-cos, -sin, -sin, cos] : [cos, sin, -sin, cos];
}
