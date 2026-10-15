import { decimal } from "../../../kernel/numbers.ts";
import type { SnapshotNode } from "../../../types/snapshot.ts";
import type { CssDeclarations } from "../../css-declarations.ts";
import type { GridTrack } from "../../figma-props.ts";
import type { WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, splitTop } from "../../values/css-values.ts";
import { px } from "../../values/format.ts";
import { gapsOf } from "./gaps.ts";

/** A grid's tracks and gaps; a grid's own padding and alignment stay Figma's. */
export function readGrid(node: SnapshotNode, css: CssDeclarations): void {
  css.set("display", "grid");

  const columns =
    tracksCss(node.gridColumnSizes) ??
    (node.gridColumnCount === undefined ? null : `repeat(${node.gridColumnCount}, 1fr)`);
  const rows = tracksCss(node.gridRowSizes);

  if (columns !== null) {
    css.set("grid-template-columns", columns);
  }

  if (rows !== null) {
    css.set("grid-template-rows", rows);
  }

  css.setLength("column-gap", "gridColumnGap", node.gridColumnGap);
  css.setLength("row-gap", "gridRowGap", node.gridRowGap);
}

/** Grid tracks: a flex track is `fr`, a fixed one pixels, a hugging one `auto`; equal tracks as repeat(). */
function tracksCss(tracks: SnapshotNode["gridColumnSizes"]): string | null {
  if (tracks === undefined || tracks.length === 0) {
    return null;
  }

  const sizes = tracks.map((track) =>
    track.type === "FIXED" ? px(track.value ?? 0) : track.type === "HUG" ? "auto" : `${decimal(track.value ?? 1)}fr`,
  );
  const [first] = sizes;

  return sizes.length > 2 && sizes.every((size) => size === first)
    ? `repeat(${sizes.length}, ${first})`
    : sizes.join(" ");
}

/** A grid layout: its tracks and gaps; a flex direction or wrap is an error, a grid places children in tracks. */
export function gridLayout(input: WriteInput, out: WriteOutput): void {
  const { merged, changed } = input;

  out.set("layoutMode", "GRID", "display");

  for (const [attribute, key] of [
    ["grid-template-columns", "gridColumns"],
    ["grid-template-rows", "gridRows"],
  ] as const) {
    const value = merged(attribute);
    const tracks = value === undefined ? undefined : tracksOf(value);

    if (tracks === null) {
      out.fail(attribute, `${attribute}="${value}" is not tracks in fr, px or auto (repeat() allowed).`);
    } else if (tracks !== undefined) {
      out.set(key, tracks, attribute);
    }
  }

  const { row, column } = gapsOf(input, out);

  if (column !== undefined) {
    out.set("gridColumnGap", column.value, column.attribute);
  }

  if (row !== undefined) {
    out.set("gridRowGap", row.value, row.attribute);
  }

  for (const name of ["flex-direction", "flex-wrap"].filter(changed)) {
    out.fail(name, `${name} needs display="flex": a grid places its children in tracks.`);
  }
}

function tracksOf(value: string): GridTrack[] | null {
  const items = splitTop(value, " ").flatMap(repeated);
  const tracks = items.map(trackOf);

  return tracks.length === 0 || tracks.includes(null) ? null : (tracks as GridTrack[]);
}

/** A track list's part, with repeat(N, track) written out. */
function repeated(part: string): string[] {
  const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(part);

  return repeat === null ? [part] : Array.from({ length: Number(repeat[1]) }, () => (repeat[2] ?? "").trim());
}

/** One track: fr is a flexible one, auto hugs its content, px is fixed; null for anything else. */
function trackOf(item: string): GridTrack | null {
  const fraction = /^(\d*\.?\d+)fr$/.exec(item);
  const pixels = lengthOf(item);

  if (fraction !== null) {
    return {
      type: "FLEX",
      value: Number(fraction[1]),
    };
  }

  if (item === "auto") {
    return { type: "HUG" };
  }

  return typeof pixels === "number"
    ? {
        type: "FIXED",
        value: pixels,
      }
    : null;
}
