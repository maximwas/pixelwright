import { dimensionOf, numberOf, splitTop } from "../../css-mapping/values/css-values.ts";
import { Color } from "../../kernel/color/color.ts";
import { COLOR_PRECISION, LENGTH_PRECISION, wordsOf } from "./compared.ts";
import { sameImages, sameShadows, sameTransform } from "./shape-comparisons.ts";
import type { Longhand, LonghandKind } from "./types.ts";

const NUMBER_PRECISION = 0.01;

const START = ["flex-start", "start"];
const END = ["flex-end", "end"];

/** Keywords that show the same though spelled apart, by property. */
const SYNONYMS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  "justify-content": [["normal", ...START], END],
  "align-items": [START, END],
  "align-content": [START, END],
  "align-self": [
    [...START, "self-start"],
    [...END, "self-end"],
  ],
  "justify-self": [
    [...START, "self-start", "left"],
    [...END, "self-end", "right"],
  ],
  "text-align": [
    ["left", "start"],
    ["right", "end"],
  ],
  "overflow-x": [["hidden", "clip"]],
  "overflow-y": [["hidden", "clip"]],
  "font-style": [["italic", "oblique"]],
};

/** How one kind of value is compared. */
interface Comparison {
  /** Whether a design value can be checked against a computed one; any can when this is not given. */
  readonly comparable?: (design: string) => boolean;
  readonly same: (longhand: Longhand, build: string, tolerance: number) => boolean;
}

export const COMPARISONS: Readonly<Record<LonghandKind, Comparison>> = {
  box: {
    // A computed size or place is in px (a max may be none): a percent, calc() or auto is not one to hold it against.
    comparable: (design) => pixelsOf(design) !== null || wordsOf(design) === "none",
    same: sameBox,
  },
  length: {
    comparable: (design) => dimensionOf(design)?.unit !== "em",
    same: ({ property, value }, build) => sameLength(property, value, build),
  },
  color: { same: ({ value }, build) => sameColor(value, build) },
  keyword: { same: ({ property, value }, build) => sameKeyword(property, value, build) },
  family: { same: ({ value }, build) => familyOf(value) === familyOf(build) },
  number: { same: ({ value }, build) => near(amountOf(value), amountOf(build), NUMBER_PRECISION) },
  shadows: { same: ({ property, value }, build) => sameShadows(property, value, build) },
  images: { same: ({ value }, build) => sameImages(value, build) },
  transform: { same: ({ value }, build) => sameTransform(value, build) },
  tracks: {
    // A computed grid holds its tracks in px: fr, repeat() and minmax() are not to hold them against.
    comparable: (design) => splitTop(design, " ").every((track) => pixelsOf(track) !== null),
    same: sameTracks,
  },
  unread: {
    comparable: () => false,
    same: () => false,
  },
};

/** A CSS colour, or one mixed with transparent at a percent (how design_read writes a token at an opacity). */
function colorOf(value: string): Color | null {
  const mixed = /^color-mix\(\s*in\s+[a-z0-9-]+\s*,\s*(.+?)\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/i.exec(value.trim());
  const color = Color.parse(mixed?.[1] ?? value);

  return mixed === null || color === null ? color : color.faded(Number(mixed[2]) / 100);
}

/** A size or a place within the tolerance, which layout rounds; a keyword (none, auto) as a keyword. */
function sameBox({ property, value }: Longhand, build: string, tolerance: number): boolean {
  const [mine, theirs] = [pixelsOf(value), pixelsOf(build)];

  return mine === null || theirs === null ? sameKeyword(property, value, build) : Math.abs(mine - theirs) <= tolerance;
}

/** Lengths in one unit, within float noise; keywords (normal, auto) as keywords. */
function sameLength(property: string, value: string, build: string): boolean {
  const [mine, theirs] = [dimensionOf(value), dimensionOf(build)];

  if (mine === null || theirs === null) {
    return sameKeyword(property, value, build);
  }

  return unitOf(mine) === unitOf(theirs) && Math.abs(mine.value - theirs.value) <= LENGTH_PRECISION;
}

function sameColor(value: string, build: string): boolean {
  const [mine, theirs] = [colorOf(value), colorOf(build)];

  return mine === null || theirs === null ? wordsOf(value) === wordsOf(build) : mine.equals(theirs, COLOR_PRECISION);
}

function sameKeyword(property: string, value: string, build: string): boolean {
  const [mine, theirs] = [wordsOf(value), wordsOf(build)];

  return mine === theirs || (SYNONYMS[property] ?? []).some((same) => same.includes(mine) && same.includes(theirs));
}

/** Grid tracks in px, each within the tolerance: layout sizes them. */
function sameTracks({ value }: Longhand, build: string, tolerance: number): boolean {
  const [mine, theirs] = [splitTop(value, " ").map(pixelsOf), splitTop(build, " ").map(pixelsOf)];

  return mine.length === theirs.length && mine.every((track, index) => near(track, theirs[index] ?? null, tolerance));
}

/** The first family of a font-family list, as compared. */
function familyOf(value: string): string {
  return wordsOf(splitTop(value, ",")[0] ?? "");
}

/** A number; a font weight's names as their numbers. */
function amountOf(value: string): number | null {
  const word = value.trim().toLowerCase();

  return numberOf(word === "normal" ? "400" : word === "bold" ? "700" : word);
}

function near(mine: number | null, theirs: number | null, precision: number): boolean {
  return mine !== null && theirs !== null && Math.abs(mine - theirs) <= precision;
}

/** A length in px, a bare 0 as one; null for any other value. */
function pixelsOf(value: string): number | null {
  const length = dimensionOf(value);

  return length === null || unitOf(length) !== "px" ? null : length.value;
}

function unitOf({ value, unit }: { readonly value: number; readonly unit: string }): string {
  return unit === "" && value === 0 ? "px" : unit;
}
