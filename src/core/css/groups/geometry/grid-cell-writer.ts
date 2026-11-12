import { injectable } from "@needle-di/core";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  CELL_ATTRIBUTES,
  GEOMETRY_AXIS,
  GEOMETRY_ERROR,
  GEOMETRY_NUMBER,
  GEOMETRY_PATTERN,
  GEOMETRY_WRITE,
  SELF_FIGMA,
} from "@/core/css/groups/geometry/geometry.constants.ts";
import type { GeometryAxis } from "@/core/css/groups/geometry/placement.ts";

/**
 * A child's own alignment and its grid cell written back (C-058): justify-self and align-self (in a grid its place in
 * the cell, in a flex parent stretch fills across), and the lines it spans as Figma's first track (from 0) and span.
 * Each axis answers for its own attribute, so a bad grid-row is grid-row's error when grid-column is given too.
 */
@injectable()
export class GridCellWriter implements PropertyWriter {
  readonly attributes = CELL_ATTRIBUTES;

  write({ own, changed }: WriteInput, out: WriteOutput): void {
    for (const axis of Object.values(GEOMETRY_AXIS)) {
      if (changed(axis.align)) {
        this.#self(axis, (own(axis.align) ?? "").trim(), out);
      }

      if (changed(axis.line)) {
        this.#lines(axis, (own(axis.line) ?? "").trim(), out);
      }
    }
  }

  #self(
    { align, selfKey }: GeometryAxis,
    value: string,
    out: WriteOutput,
  ): void {
    const mapped = Object.hasOwn(SELF_FIGMA, value) ? SELF_FIGMA[value] : undefined;

    if (mapped === undefined) {
      out.fail(align, GEOMETRY_ERROR.badSelf(align, value, Object.keys(SELF_FIGMA).join(GEOMETRY_WRITE.listJoint)));
    } else {
      out.set(selfKey, mapped, align);
    }
  }

  /** "N", "N / span M" or "N / M", lines counted from 1. */
  #lines(
    { line, cell }: GeometryAxis,
    value: string,
    out: WriteOutput,
  ): void {
    const match = GEOMETRY_PATTERN.lines.exec(value);
    const first = Number(match?.[1]);
    const [, , spanned, end] = match ?? [];
    const span =
      spanned === undefined ? (end === undefined ? GEOMETRY_NUMBER.oneTrack : Number(end) - first) : Number(spanned);

    if (match === null || first < GEOMETRY_NUMBER.firstLine || span < GEOMETRY_NUMBER.oneTrack) {
      out.fail(line, GEOMETRY_ERROR.badLines(line, value));
    } else {
      out.set(cell, { anchor: first - GEOMETRY_NUMBER.firstLine, span }, line);
    }
  }
}
