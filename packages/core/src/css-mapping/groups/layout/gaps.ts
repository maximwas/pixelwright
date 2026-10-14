import type { LengthValue } from "../../../types/apply.ts";
import type { WriteInput, WriteOutput } from "../../property-group.ts";
import { lengthOf, splitTop } from "../../values/css-values.ts";

/** The row and column gaps: `gap` gives both (or row then column), row-gap and column-gap one each. */
export function gapsOf(
  { own, merged }: Pick<WriteInput, "own" | "merged">,
  out: WriteOutput,
): { row?: { value: LengthValue; attribute: string }; column?: { value: LengthValue; attribute: string } } {
  // A gap the element gives resets the row and column gaps the layer has, as the CSS shorthand does.
  const shorthand = own("gap") !== undefined;
  const gap = merged("gap");
  let parts = gap === undefined ? [] : splitTop(gap, " ").map(lengthOf);

  if (gap !== undefined && (parts.length === 0 || parts.length > 2 || parts.includes(null))) {
    out.fail("gap", `gap="${gap}" is not one or two lengths in px or tokens (rows, then columns).`);
    parts = [];
  }

  const result: {
    row?: { value: LengthValue; attribute: string };
    column?: { value: LengthValue; attribute: string };
  } = {};

  for (const [axis, attribute, part] of [
    ["row", "row-gap", parts[0]],
    ["column", "column-gap", parts[1] ?? parts[0]],
  ] as const) {
    const value = shorthand ? own(attribute) : merged(attribute);

    if (value === undefined) {
      if (part !== undefined && part !== null) {
        result[axis] = {
          value: part,
          attribute: "gap",
        };
      }

      continue;
    }

    const length = value === "normal" ? 0 : lengthOf(value);

    if (length === null) {
      out.fail(attribute, `${attribute}="${value}" is not a length in px or a token.`);
    } else {
      result[axis] = {
        value: length,
        attribute,
      };
    }
  }

  return result;
}
