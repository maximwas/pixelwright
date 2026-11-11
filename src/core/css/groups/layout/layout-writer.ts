import { inject, injectable } from "@needle-di/core";
import { LAYOUT_TAGS } from "@/core/apply/apply.constants.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { GAP_READER } from "@/core/css/groups/layout/gap-reader.ts";
import { GRID_WRITER } from "@/core/css/groups/layout/grid-writer.ts";
import {
  ALIGN_CONTENT_FIGMA,
  ALIGN_FIGMA,
  DISPLAY_MODE,
  FIGMA_FLEX,
  JUSTIFY_FIGMA,
  LAYOUT_ATTRIBUTES,
  LAYOUT_ERROR,
  LAYOUT_RULE_ATTRIBUTES,
  LAYOUT_VALUE,
  PADDING_SIDES,
} from "@/core/css/groups/layout/layout.constants.ts";
import { CSS_LENGTH, type LengthValue } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Sides = [LengthValue, LengthValue, LengthValue, LengthValue];

/** One keyword alignment: its attribute, the keywords Figma has for it, and whether a grid refuses it. */
interface Alignment<Key extends keyof FigmaProps> {
  readonly attribute: string;
  readonly table: Readonly<Record<string, Exclude<FigmaProps[Key], undefined>>>;
  readonly key: Key;
  readonly flexOnly: boolean;
}

/**
 * A frame's layout written back (C-034..C-040): the display with its direction, wrap and gaps, the padding, the
 * alignments. It reads merged values (display absent is block, none hides and keeps the layout), so a gap or a
 * direction given alone still knows the layer's display.
 */
@injectable()
export class LayoutWriter implements PropertyWriter {
  readonly attributes = LAYOUT_ATTRIBUTES;
  readonly #lengths;
  readonly #split;
  readonly #gaps;
  readonly #grid;

  constructor(
    lengths = inject(CSS_LENGTH),
    split = inject(CSS_SPLIT),
    gaps = inject(GAP_READER),
    grid = inject(GRID_WRITER),
  ) {
    this.#lengths = lengths;
    this.#split = split;
    this.#gaps = gaps;
    this.#grid = grid;
  }

  write(input: WriteInput, out: WriteOutput): void {
    const { changed } = input;

    if (LAYOUT_RULE_ATTRIBUTES.some(changed)) {
      this.#layout(input, out);
    }

    if ([CSS_PROPERTY.padding, ...PADDING_SIDES].some(changed)) {
      this.#padding(input, out);
    }

    if (changed(CSS_PROPERTY.justifyContent)) {
      this.#alignment(
        {
          attribute: CSS_PROPERTY.justifyContent,
          table: JUSTIFY_FIGMA,
          key: INTENT_KEY.primaryAxisAlignItems,
          flexOnly: true,
        },
        input,
        out,
      );
    }

    if (changed(CSS_PROPERTY.alignItems)) {
      this.#alignment(
        {
          attribute: CSS_PROPERTY.alignItems,
          table: ALIGN_FIGMA,
          key: INTENT_KEY.counterAxisAlignItems,
          flexOnly: true,
        },
        input,
        out,
      );
    }

    if (changed(CSS_PROPERTY.alignContent)) {
      this.#alignment(
        {
          attribute: CSS_PROPERTY.alignContent,
          table: ALIGN_CONTENT_FIGMA,
          key: INTENT_KEY.counterAxisAlignContent,
          flexOnly: false,
        },
        input,
        out,
      );
    }
  }

  /** Auto layout: the direction, wrap and gaps, read together since a gap means another axis in another direction. */
  #layout(input: WriteInput, out: WriteOutput): void {
    const { merged, changed } = input;
    const display = merged(CSS_PROPERTY.display);
    const mode = display === undefined ? LAYOUT_VALUE.block : DISPLAY_MODE[display];

    if (mode === undefined) {
      out.fail(CSS_PROPERTY.display, LAYOUT_ERROR.badDisplay(display ?? ""));
    } else if (mode === LAYOUT_VALUE.none) {
      // Hidden: the layout it has stays for when it is shown again.
      out.set(INTENT_KEY.visible, false, CSS_PROPERTY.display);
    } else {
      if (changed(CSS_PROPERTY.display) && input.hidden) {
        out.set(INTENT_KEY.visible, true, CSS_PROPERTY.display);
      }

      if (mode === LAYOUT_VALUE.grid) {
        this.#grid.write(input, out);
      } else if (mode === LAYOUT_VALUE.flex) {
        this.#flex(input, out);
      } else {
        this.#block(input, out, display);
      }
    }
  }

  /** No auto layout: a layout tag displayed as a block loses it, and what only a layout has is an error. */
  #block(
    input: WriteInput,
    out: WriteOutput,
    display: string | undefined,
  ): void {
    if (display !== undefined && LAYOUT_TAGS.has(input.tag)) {
      out.set(INTENT_KEY.layoutMode, FIGMA_FLEX.none, CSS_PROPERTY.display);
    }

    for (const name of LAYOUT_RULE_ATTRIBUTES.slice(1).filter(input.changed)) {
      out.fail(name, LAYOUT_ERROR.needsLayout(name));
    }
  }

  /** A flex layout: the direction, wrap and the gaps along and across it; grid tracks are an error. */
  #flex(input: WriteInput, out: WriteOutput): void {
    const { merged, changed } = input;
    const direction = merged(CSS_PROPERTY.flexDirection) ?? LAYOUT_VALUE.row;

    if (direction !== LAYOUT_VALUE.row && direction !== LAYOUT_VALUE.column) {
      out.fail(CSS_PROPERTY.flexDirection, LAYOUT_ERROR.badDirection(direction));

      return;
    }

    const vertical = direction === LAYOUT_VALUE.column;
    const wrap = merged(CSS_PROPERTY.flexWrap);

    out.set(
      INTENT_KEY.layoutMode,
      vertical ? FIGMA_FLEX.vertical : FIGMA_FLEX.horizontal,
      merged(CSS_PROPERTY.flexDirection) === undefined ? CSS_PROPERTY.display : CSS_PROPERTY.flexDirection,
    );

    if (wrap === LAYOUT_VALUE.wrap || wrap === LAYOUT_VALUE.nowrap) {
      out.set(
        INTENT_KEY.layoutWrap,
        wrap === LAYOUT_VALUE.wrap ? FIGMA_FLEX.wrap : FIGMA_FLEX.noWrap,
        CSS_PROPERTY.flexWrap,
      );
    } else if (wrap !== undefined) {
      out.fail(CSS_PROPERTY.flexWrap, LAYOUT_ERROR.badWrap(wrap));
    }

    this.#flexGaps(input, out, vertical, wrap === LAYOUT_VALUE.wrap);

    for (const name of [CSS_PROPERTY.gridTemplateColumns, CSS_PROPERTY.gridTemplateRows].filter(changed)) {
      out.fail(name, LAYOUT_ERROR.needsGrid(name));
    }
  }

  /** As in CSS: along a row the columns are spaced, along a column the rows; the other gap is between wrapped lines. */
  #flexGaps(
    input: WriteInput,
    out: WriteOutput,
    vertical: boolean,
    wraps: boolean,
  ): void {
    const { row, column } = this.#gaps.of(input, out);
    const along = vertical ? row : column;
    const across = vertical ? column : row;

    if (along !== undefined) {
      out.set(INTENT_KEY.itemSpacing, along.value, along.attribute);
    }

    if (across !== undefined && wraps) {
      out.set(INTENT_KEY.counterAxisSpacing, across.value, across.attribute);
    }
  }

  /** The padding shorthand (the layer's when the element gives none), then each side given on its own over it (C-039). */
  #padding({ own, merged }: WriteInput, out: WriteOutput): void {
    const value = merged(CSS_PROPERTY.padding) ?? LAYOUT_VALUE.zero;
    const sides = this.#box(value);

    if (sides === null) {
      out.fail(CSS_PROPERTY.padding, LAYOUT_ERROR.badBox(value));

      return;
    }

    for (const [index, name] of PADDING_SIDES.entries()) {
      const side = own(name);
      const length = side === undefined ? undefined : this.#lengths.pixels(side.trim());

      if (length === null) {
        out.fail(name, LAYOUT_ERROR.badSide(name, side ?? ""));

        return;
      }

      if (length !== undefined) {
        sides[index] = length;
      }
    }

    const source =
      own(CSS_PROPERTY.padding) === undefined
        ? (PADDING_SIDES.find(own) ?? CSS_PROPERTY.padding)
        : CSS_PROPERTY.padding;

    out.set(INTENT_KEY.padding, sides, source);
  }

  /** One to four lengths as the four sides, top first; null for anything else. */
  #box(value: string): Sides | null {
    const parts = this.#split.split(value, CSS_SEPARATOR.space).map((part) => this.#lengths.pixels(part));
    const [top, right = top, bottom = top, left = right] = parts;

    return parts.length === 0 || parts.length > 4 || parts.includes(null) || top === null || top === undefined
      ? null
      : ([top, right, bottom, left] as Sides);
  }

  /** A flex alignment, one keyword; a grid refuses the flex ones in plain words (C-038). */
  #alignment<Key extends keyof FigmaProps>(
    { attribute, table, key, flexOnly }: Alignment<Key>,
    input: WriteInput,
    out: WriteOutput,
  ): void {
    if (flexOnly && input.merged(CSS_PROPERTY.display) === LAYOUT_VALUE.grid) {
      out.fail(attribute, LAYOUT_ERROR.flexOnly(attribute), LAYOUT_ERROR.flexOnlyHint);

      return;
    }

    const value = input.own(attribute) ?? "";
    const mapped = table[value];

    if (mapped === undefined) {
      out.fail(attribute, LAYOUT_ERROR.badKeyword(attribute, value, Object.keys(table).join(LAYOUT_VALUE.listJoint)));
    } else {
      out.set(key, mapped, attribute);
    }
  }
}
