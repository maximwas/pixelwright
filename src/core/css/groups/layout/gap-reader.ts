import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { LAYOUT_ERROR, LAYOUT_VALUE } from "@/core/css/groups/layout/layout.constants.ts";
import { CSS_LENGTH, type LengthValue } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";

/** A gap and the attribute it was read from, for the plugin's errors. */
export interface Gap {
  readonly value: LengthValue;
  readonly attribute: string;
}

/**
 * The row and column gaps (C-034): `gap` gives both (or row then column), row-gap and column-gap one each. A gap the
 * element gives resets the row and column gaps the layer has, as the CSS shorthand does (O-017).
 */
@injectable()
export class GapReader {
  readonly #lengths;
  readonly #split;

  constructor(lengths = inject(CSS_LENGTH), split = inject(CSS_SPLIT)) {
    this.#lengths = lengths;
    this.#split = split;
  }

  of({ own, merged }: Pick<WriteInput, "own" | "merged">, out: WriteOutput): { row?: Gap; column?: Gap } {
    const read = own(CSS_PROPERTY.gap) === undefined ? merged : own;
    const parts = this.#shorthand(merged(CSS_PROPERTY.gap), out);
    const row = this.#axis(CSS_PROPERTY.rowGap, read(CSS_PROPERTY.rowGap), parts[0], out);
    const column = this.#axis(CSS_PROPERTY.columnGap, read(CSS_PROPERTY.columnGap), parts[1] ?? parts[0], out);

    return { ...(row === undefined ? {} : { row }), ...(column === undefined ? {} : { column }) };
  }

  /** The gap shorthand's one or two lengths; none, after its error, when it is anything else. */
  #shorthand(gap: string | undefined, out: WriteOutput): LengthValue[] {
    if (gap === undefined) {
      return [];
    }

    const parts = this.#split.split(gap, CSS_SEPARATOR.space).map((part) => this.#lengths.pixels(part));
    const lengths = parts.filter((part) => part !== null);

    if (lengths.length === 0 || lengths.length > 2 || lengths.length < parts.length) {
      out.fail(CSS_PROPERTY.gap, LAYOUT_ERROR.badGapShorthand(gap));

      return [];
    }

    return lengths;
  }

  /** One axis's gap: its own attribute (normal is 0), else the shorthand's part; none after its error. */
  #axis(
    attribute: string,
    value: string | undefined,
    part: LengthValue | undefined,
    out: WriteOutput,
  ): Gap | undefined {
    if (value === undefined) {
      return part === undefined ? undefined : { value: part, attribute: CSS_PROPERTY.gap };
    }

    const length = value === LAYOUT_VALUE.normal ? 0 : this.#lengths.pixels(value);

    if (length === null) {
      out.fail(attribute, LAYOUT_ERROR.badSide(attribute, value));

      return undefined;
    }

    return { value: length, attribute };
  }
}

export const GAP_READER = new InjectionToken<GapReader>("GapReader");
