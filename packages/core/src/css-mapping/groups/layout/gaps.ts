import type { LengthValue } from "../../figma-props.ts";
import type { WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, splitTop } from "../../values/css-values.ts";

/** A gap and the attribute it was read from, for the plugin's errors. */
export interface Gap {
  readonly value: LengthValue;
  readonly attribute: string;
}

/**
 * The row and column gaps: `gap` gives both (or row then column), row-gap and column-gap one each. A gap the element
 * gives resets the row and column gaps the layer has, as the CSS shorthand does.
 */
export function gapsOf(
  { own, merged }: Pick<WriteInput, "own" | "merged">,
  out: WriteOutput,
): { row?: Gap; column?: Gap } {
  const shorthand = own("gap") !== undefined;
  const parts = shorthandParts(merged("gap"), out);
  const read = shorthand ? own : merged;
  const row = gapOf("row-gap", read("row-gap"), parts[0], out);
  const column = gapOf("column-gap", read("column-gap"), parts[1] ?? parts[0], out);

  return {
    ...(row === undefined ? {} : { row }),
    ...(column === undefined ? {} : { column }),
  };
}

/** The gap shorthand's one or two lengths; none, after its error, when it is anything else. */
function shorthandParts(gap: string | undefined, out: WriteOutput): LengthValue[] {
  const parts = gap === undefined ? [] : splitTop(gap, " ").map(lengthOf);

  if (gap !== undefined && (parts.length === 0 || parts.length > 2 || parts.includes(null))) {
    out.fail("gap", `gap="${gap}" is not one or two lengths in px or tokens (rows, then columns).`);

    return [];
  }

  return parts as LengthValue[];
}

/** One axis's gap: its own attribute (normal is 0), else the shorthand's part; none after its error. */
function gapOf(
  attribute: string,
  value: string | undefined,
  part: LengthValue | undefined,
  out: WriteOutput,
): Gap | undefined {
  if (value === undefined) {
    return part === undefined
      ? undefined
      : {
          value: part,
          attribute: "gap",
        };
  }

  const length = value === "normal" ? 0 : lengthOf(value);

  if (length === null) {
    out.fail(attribute, `${attribute}="${value}" is not a length in px or a token.`);

    return undefined;
  }

  return {
    value: length,
    attribute,
  };
}
