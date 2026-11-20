import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  GEOMETRY_ERROR,
  GEOMETRY_WRITE,
  SIZE_ATTRIBUTES,
  SIZE_LIMITS,
} from "@/core/css/groups/geometry/geometry.constants.ts";
import { CSS_LENGTH } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_PATTERN, CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";

/** The size limits and filling the flex parent's direction, written back (C-055, C-056). */
@injectable()
export class SizeWriter implements PropertyWriter {
  readonly attributes = SIZE_ATTRIBUTES;
  readonly #lengths;
  readonly #split;

  constructor(lengths = inject(CSS_LENGTH), split = inject(CSS_SPLIT)) {
    this.#lengths = lengths;
    this.#split = split;
  }

  write({ own, changed }: WriteInput, out: WriteOutput): void {
    for (const [attribute, key] of SIZE_LIMITS.filter(([attribute]) => changed(attribute))) {
      const value = (own(attribute) ?? "").trim();
      const length = this.#lengths.pixels(value);

      // none, auto or 0 takes the limit away.
      if (value === GEOMETRY_WRITE.none || value === GEOMETRY_WRITE.auto || length === 0) {
        out.set(key, null, attribute);
      } else if (length === null) {
        out.fail(attribute, GEOMETRY_ERROR.badLimit(attribute, value));
      } else {
        out.set(key, length, attribute);
      }
    }

    if (changed(CSS_PROPERTY.flex)) {
      this.#grow(own(CSS_PROPERTY.flex) ?? "", out);
    }
  }

  /** flex: 1 fills the flex parent's direction, none (or 0) does not; Figma has no grow weights. */
  #grow(given: string, out: WriteOutput): void {
    const value = given.trim().replace(CSS_PATTERN.spaces, CSS_SEPARATOR.space);
    const [first = ""] = this.#split.split(value, CSS_SEPARATOR.space);
    const words: Readonly<Record<string, number>> = {
      [GEOMETRY_WRITE.none]: 0,
      [GEOMETRY_WRITE.initial]: 0,
      [GEOMETRY_WRITE.auto]: 1,
    };
    const grow = words[value] ?? (CSS_PATTERN.bare.test(first) ? Number(first) : null);

    if (grow === 0 || grow === 1) {
      out.set(INTENT_KEY.grow, grow === 1, CSS_PROPERTY.flex);
    } else {
      out.fail(CSS_PROPERTY.flex, GEOMETRY_ERROR.growWeight(value));
    }
  }
}
