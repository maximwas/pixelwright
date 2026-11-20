import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { GAP_READER } from "@/core/css/groups/layout/gap-reader.ts";
import { FIGMA_FLEX, LAYOUT_ERROR, LAYOUT_VALUE, TRACK_PATTERN } from "@/core/css/groups/layout/layout.constants.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";
import type { GridTrack } from "@/shared/write-intents/write-intent.schema.ts";

/** The grid tracks a frame writes and the attribute each comes from. */
const TRACK_ATTRIBUTES = [
  [CSS_PROPERTY.gridTemplateColumns, INTENT_KEY.gridColumns],
  [CSS_PROPERTY.gridTemplateRows, INTENT_KEY.gridRows],
] as const;

/** A grid layout (C-036, C-037): its tracks and gaps; a flex direction or wrap is an error. */
@injectable()
export class GridWriter {
  readonly #lengths;
  readonly #split;
  readonly #gaps;

  constructor(
    lengths = inject(CSS_LENGTH),
    split = inject(CSS_SPLIT),
    gaps = inject(GAP_READER),
  ) {
    this.#lengths = lengths;
    this.#split = split;
    this.#gaps = gaps;
  }

  write(input: WriteInput, out: WriteOutput): void {
    const { merged, changed } = input;
    const becomesGrid = changed(CSS_PROPERTY.display);

    out.set(INTENT_KEY.layoutMode, FIGMA_FLEX.grid, CSS_PROPERTY.display);

    for (const [attribute, key] of TRACK_ATTRIBUTES) {
      // Only the tracks the call gives (all of them on a frame that becomes a grid): rows read earlier and sent back
      // would delete a row Figma added for children that did not fit, and Figma refuses to delete a taken row (B-049).
      if (!becomesGrid && !changed(attribute)) {
        continue;
      }

      const value = merged(attribute);
      const tracks = value === undefined ? undefined : this.#tracks(value);

      if (tracks === null) {
        out.fail(attribute, LAYOUT_ERROR.badTracks(attribute, value ?? ""));
      } else if (tracks !== undefined) {
        out.set(key, tracks, attribute);
      }
    }

    const { row, column } = this.#gaps.of(input, out);

    if (column !== undefined) {
      out.set(INTENT_KEY.gridColumnGap, column.value, column.attribute);
    }

    if (row !== undefined) {
      out.set(INTENT_KEY.gridRowGap, row.value, row.attribute);
    }

    for (const name of [CSS_PROPERTY.flexDirection, CSS_PROPERTY.flexWrap].filter(changed)) {
      out.fail(name, LAYOUT_ERROR.needsFlex(name));
    }
  }

  #tracks(value: string): GridTrack[] | null {
    const tracks = this.#split
      .split(value, CSS_SEPARATOR.space)
      .flatMap((part) => this.#repeated(part))
      .map((item) => this.#track(item));

    return tracks.length === 0 || tracks.includes(null) ? null : (tracks as GridTrack[]);
  }

  /** A track list's part, with repeat(N, track) written out. */
  #repeated(part: string): string[] {
    const repeat = TRACK_PATTERN.repeat.exec(part);

    return repeat === null ? [part] : Array.from({ length: Number(repeat[1]) }, () => (repeat[2] ?? "").trim());
  }

  /** One track: fr is a flexible one, auto hugs its content, px is fixed; null for anything else. */
  #track(item: string): GridTrack | null {
    const fraction = TRACK_PATTERN.fraction.exec(item);
    const pixels = this.#lengths.length(item);

    if (fraction !== null) {
      return { type: FIGMA_FLEX.flexTrack, value: Number(fraction[1]) };
    }

    if (item === LAYOUT_VALUE.hugTrack) {
      return { type: FIGMA_FLEX.hug };
    }

    return typeof pixels === "number" ? { type: FIGMA_FLEX.fixedTrack, value: pixels } : null;
  }
}

export const GRID_WRITER = new InjectionToken<GridWriter>("GridWriter");
