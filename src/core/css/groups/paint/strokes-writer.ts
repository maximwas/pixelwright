import { inject, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  BORDER_STYLES,
  PAINT_ERROR,
  PAINT_VALUE as PAINT_WORD,
  PAINT_WRITE,
  STROKE_SIDES,
  STROKES_WRITTEN,
} from "@/core/css/groups/paint/paint.constants.ts";
import { PAINT_VALUE, type PaintSpec } from "@/core/css/paints/paint-value.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { INTENT_KEY, INTENT_STROKE_ALIGN } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type StrokeSpec = NonNullable<FigmaProps["strokes"]>;

type Read = WriteInput["own"];

/** One side as drawn: its weight, whether it is dashed, its paint. */
interface Side {
  readonly weight: number;
  readonly dash: boolean;
  readonly paint: PaintSpec;
}

/** A side: drawn, not drawn (null), or not read (false: its error is out). */
type SideRead = Side | null | false;

/**
 * Strokes written back (C-091, FX-060): Figma strokes a layer once, every side in one colour and style. A border or an
 * outline in the element resets every side, as the CSS shorthands do; a side alone changes only itself, the others
 * kept from what the layer has. border is inside, outline outside; both at once are refused.
 */
@injectable()
export class StrokesWriter implements PropertyWriter {
  readonly attributes = STROKES_WRITTEN;
  readonly #paints;
  readonly #lengths;
  readonly #split;

  constructor(
    paints = inject(PAINT_VALUE),
    lengths = inject(CSS_LENGTH),
    split = inject(CSS_SPLIT),
  ) {
    this.#paints = paints;
    this.#lengths = lengths;
    this.#split = split;
  }

  write({ own, merged }: WriteInput, out: WriteOutput): void {
    const read = own(CSS_PROPERTY.border) !== undefined || own(CSS_PROPERTY.outline) !== undefined ? own : merged;
    const border = read(CSS_PROPERTY.border)?.trim();
    const outline = read(CSS_PROPERTY.outline)?.trim();
    const source = STROKES_WRITTEN.find((name) => own(name) !== undefined) ?? CSS_PROPERTY.border;

    if (border !== undefined && outline !== undefined && border !== PAINT_WRITE.none && outline !== PAINT_WRITE.none) {
      out.fail(CSS_PROPERTY.outline, PAINT_ERROR.both);

      return;
    }

    const outside = outline !== undefined && outline !== PAINT_WRITE.none;
    const shorthand = outside ? this.#side(CSS_PROPERTY.outline, outline, out) : this.#shorthand(border, out);
    const sides = this.#sides(read, shorthand, out);

    if (sides === null) {
      return;
    }

    const stroke = this.#stroke(sides, outside ? INTENT_STROKE_ALIGN.OUTSIDE : INTENT_STROKE_ALIGN.INSIDE);

    if (stroke === null) {
      out.fail(
        STROKE_SIDES.map(([, name]) => name).find((name) => own(name) !== undefined) ?? source,
        PAINT_ERROR.sidesDiffer,
      );
    } else {
      out.set(INTENT_KEY.strokes, stroke, source);
    }
  }

  /** The border shorthand's side; null when there is none. */
  #shorthand(border: string | undefined, out: WriteOutput): SideRead {
    return border === undefined ? null : this.#side(CSS_PROPERTY.border, border, out);
  }

  /** Each side: its own attribute, else the shorthand's; null when one could not be read. */
  #sides(
    read: Read,
    shorthand: SideRead,
    out: WriteOutput,
  ): (Side | null)[] | null {
    const sides = STROKE_SIDES.map(([, name]) => {
      const value = read(name);

      return value === undefined ? shorthand : this.#side(name, value, out);
    });
    const valid = sides.filter((side): side is Side | null => typeof side === "object");

    return shorthand === false || valid.length < sides.length ? null : valid;
  }

  /** The one stroke the sides make: none drawn removes it; sides of different colours or styles make none (null). */
  #stroke(sides: readonly (Side | null)[], align: StrokeSpec["align"]): StrokeSpec | null {
    const drawn = sides.filter((side): side is Side => side !== null);
    const [first] = drawn;

    if (first === undefined) {
      return { paints: [], align, dash: false };
    }

    if (drawn.some((side) => side.dash !== first.dash || !isEqual(side.paint, first.paint))) {
      return null;
    }

    const [top = 0, right = 0, bottom = 0, left = 0] = sides.map((side) => side?.weight ?? 0);
    const even = top === right && right === bottom && bottom === left;

    return {
      paints: [first.paint],
      ...(even ? { weight: top } : { sides: { top, right, bottom, left } }),
      align,
      dash: first.dash,
    };
  }

  /** One side, in any order CSS allows (`1px solid #000`); none drawn is null. */
  #side(
    attribute: string,
    value: string,
    out: WriteOutput,
  ): SideRead {
    if (value === PAINT_WRITE.none || value === PAINT_WRITE.zero) {
      return null;
    }

    const words = this.#split.split(value, CSS_SEPARATOR.space);
    const width = words.find((word) => typeof this.#lengths.length(word) === "number");
    const style = words.find((word) => Object.hasOwn(BORDER_STYLES, word));
    const paint = this.#paints.of(words.filter((word) => word !== width && word !== style).join(CSS_SEPARATOR.space));
    const weight = this.#lengths.length(width ?? "");

    if (style === PAINT_WRITE.none || style === PAINT_WRITE.hidden || weight === 0) {
      return null;
    }

    if (typeof weight !== "number" || style === undefined || paint === null) {
      out.fail(attribute, PAINT_ERROR.badSide(attribute, value));

      return false;
    }

    return { weight, dash: style !== PAINT_WORD.solid, paint };
  }
}
