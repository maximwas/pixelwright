import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import {
  APPEARANCE_ATTRIBUTES,
  APPEARANCE_ERROR,
  APPEARANCE_PATTERN,
  APPEARANCE_VALUE,
  APPEARANCE_WRITE,
  BLEND_FIGMA,
} from "@/core/css/groups/appearance/appearance.constants.ts";
import { CSS_LENGTH, type LengthValue } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_PATTERN, CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { TAG } from "@/core/xml/tags.constants.ts";
import { INTENT_KEY } from "@/shared/write-intents/write-intent.constants.ts";

/** The text attributes that truncate, read together with overflow. */
const CLIPPING = [CSS_PROPERTY.overflow, CSS_PROPERTY.textOverflow, CSS_PROPERTY.whiteSpace];

/** How a layer shows as a whole written back (C-070..C-073): opacity, blend mode, clipping or truncation, corners. */
@injectable()
export class AppearanceWriter implements PropertyWriter {
  readonly attributes = APPEARANCE_ATTRIBUTES;
  readonly #lengths;
  readonly #split;

  constructor(lengths = inject(CSS_LENGTH), split = inject(CSS_SPLIT)) {
    this.#lengths = lengths;
    this.#split = split;
  }

  write(input: WriteInput, out: WriteOutput): void {
    const { own, changed } = input;

    if (changed(CSS_PROPERTY.opacity)) {
      this.#opacity((own(CSS_PROPERTY.opacity) ?? "").trim(), out);
    }

    if (changed(CSS_PROPERTY.mixBlendMode)) {
      const value = (own(CSS_PROPERTY.mixBlendMode) ?? "").trim().toLowerCase();
      const mode = BLEND_FIGMA[value];

      if (mode === undefined) {
        out.fail(CSS_PROPERTY.mixBlendMode, APPEARANCE_ERROR.badBlend(value), APPEARANCE_ERROR.blendHint);
      } else {
        out.set(INTENT_KEY.blendMode, mode, CSS_PROPERTY.mixBlendMode);
      }
    }

    if (CLIPPING.some(changed)) {
      this.#clipping(input, out);
    }

    if (changed(CSS_PROPERTY.borderRadius)) {
      this.#radius(input.tag, (own(CSS_PROPERTY.borderRadius) ?? "").trim(), out);
    }
  }

  /** A number from 0 to 1 or a percent, held to 0..1. */
  #opacity(value: string, out: WriteOutput): void {
    const percent = APPEARANCE_PATTERN.percent.exec(value);
    const opacity =
      percent === null
        ? CSS_PATTERN.bare.test(value)
          ? Number(value)
          : null
        : Number(percent[1]) / APPEARANCE_WRITE.percent;

    if (opacity === null) {
      out.fail(CSS_PROPERTY.opacity, APPEARANCE_ERROR.badOpacity(value));
    } else {
      out.set(INTENT_KEY.opacity, Math.min(1, Math.max(0, opacity)), CSS_PROPERTY.opacity);
    }
  }

  /** A frame clips its content or not; a text truncates on one line with an ellipsis, all three attributes together. */
  #clipping({ tag, own, merged, changed }: WriteInput, out: WriteOutput): void {
    if (tag === TAG.TEXT) {
      const source = changed(CSS_PROPERTY.textOverflow) ? CSS_PROPERTY.textOverflow : CSS_PROPERTY.overflow;

      out.set(INTENT_KEY.truncate, merged(CSS_PROPERTY.textOverflow) === APPEARANCE_VALUE.ellipsis, source);

      return;
    }

    for (const name of [CSS_PROPERTY.textOverflow, CSS_PROPERTY.whiteSpace].filter(changed)) {
      out.fail(name, APPEARANCE_ERROR.truncatesText(name, tag));
    }

    const value = own(CSS_PROPERTY.overflow)?.trim();

    if (value === undefined) {
      return;
    }

    if (value === APPEARANCE_VALUE.hidden || value === APPEARANCE_WRITE.clip || value === APPEARANCE_WRITE.visible) {
      out.set(INTENT_KEY.clipsContent, value !== APPEARANCE_WRITE.visible, CSS_PROPERTY.overflow);
    } else {
      out.fail(CSS_PROPERTY.overflow, APPEARANCE_ERROR.badOverflow(value));
    }
  }

  /** One radius or four, each a length or a token; an ellipse's 50% is its own shape. */
  #radius(
    tag: string,
    value: string,
    out: WriteOutput,
  ): void {
    if (tag === TAG.ELLIPSE && value === APPEARANCE_VALUE.round) {
      return;
    }

    const parts = value.includes(APPEARANCE_WRITE.elliptical)
      ? []
      : this.#split.split(value, CSS_SEPARATOR.space).map((part) => this.#lengths.pixels(part));
    const lengths = parts.filter((part): part is LengthValue => part !== null);
    const [topLeft] = lengths;

    if (topLeft === undefined || lengths.length < parts.length || lengths.length > APPEARANCE_WRITE.maxCorners) {
      out.fail(CSS_PROPERTY.borderRadius, APPEARANCE_ERROR.badRadius(value));

      return;
    }

    const [, topRight = topLeft, bottomRight = topLeft, bottomLeft = topRight] = lengths;
    const corners = [topLeft, topRight, bottomRight, bottomLeft] as const;
    const same = corners.every((corner) => JSON.stringify(corner) === JSON.stringify(topLeft));

    out.set(INTENT_KEY.cornerRadius, same ? topLeft : [...corners], CSS_PROPERTY.borderRadius);
  }
}
