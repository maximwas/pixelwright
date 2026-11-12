import { inject, injectable } from "@needle-di/core";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import type { PropertyWriter, WriteInput, WriteOutput } from "@/core/css/css.types.ts";
import { GRADIENT_PARSER } from "@/core/css/gradients/gradient-parser.ts";
import {
  FILL_WRITES,
  FILLS_WRITTEN,
  PAINT_ERROR,
  PAINT_PATTERN,
  PAINT_WRITE,
} from "@/core/css/groups/paint/paint.constants.ts";
import { PAINT_VALUE, type PaintSpec } from "@/core/css/paints/paint-value.ts";
import { CSS_SPLIT } from "@/core/css/values/css-split.ts";
import { CSS_URL } from "@/core/css/values/css-url.ts";
import { CSS_SEPARATOR } from "@/core/css/values/values.constants.ts";
import { INTENT_PAINT, INTENT_SCALE_MODE } from "@/shared/write-intents/write-intent.constants.ts";

/**
 * A box's background and a text's colour written back as fills (C-081): none clears them; layers top first in CSS go
 * bottom first in Figma; a colour or a token (a flat gradient is its colour), and on a background a gradient or an
 * image file fitted by design_read's words. Anything else is refused with what to write instead.
 */
@injectable()
export class FillsWriter implements PropertyWriter {
  readonly attributes = FILLS_WRITTEN;
  readonly #paints;
  readonly #gradients;
  readonly #urls;
  readonly #split;

  constructor(
    paints = inject(PAINT_VALUE),
    gradients = inject(GRADIENT_PARSER),
    urls = inject(CSS_URL),
    split = inject(CSS_SPLIT),
  ) {
    this.#paints = paints;
    this.#gradients = gradients;
    this.#urls = urls;
    this.#split = split;
  }

  write({ own, changed }: WriteInput, out: WriteOutput): void {
    for (const [attribute, key] of FILL_WRITES) {
      if (!changed(attribute)) {
        continue;
      }

      const layers = this.#layers(attribute, (own(attribute) ?? "").trim(), out);

      if (layers !== null) {
        out.set(key, layers, attribute);
      }
    }
  }

  /** Paint layers, top first in CSS and bottom first in Figma; null once one of them is an error. */
  #layers(
    attribute: string,
    value: string,
    out: WriteOutput,
  ): PaintSpec[] | null {
    if (value === PAINT_WRITE.none || value === PAINT_WRITE.transparent) {
      return [];
    }

    const layers: PaintSpec[] = [];

    for (const layer of this.#split.split(value, CSS_SEPARATOR.comma)) {
      const paint = this.#layer(attribute, layer);

      if (paint === null) {
        out.fail(attribute, ...this.#refusal(attribute, layer, value));

        return null;
      }

      layers.push(paint);
    }

    return layers.reverse();
  }

  /** One layer as its paint; null when it is none. */
  #layer(attribute: string, layer: string): PaintSpec | null {
    const paint = this.#colour(layer);

    if (paint !== null || attribute !== CSS_PROPERTY.background) {
      return paint;
    }

    const gradient = this.#gradients.parse(layer);

    if (gradient !== null) {
      return { kind: INTENT_PAINT.gradient, ...gradient, stops: [...gradient.stops] };
    }

    const image = this.#urls.image(layer);

    return image === null || PAINT_WRITE.error in image
      ? null
      : { kind: INTENT_PAINT.image, src: image.src, scaleMode: this.#scale(image.rest) };
  }

  /** A colour or a token, or a flat gradient (one colour twice) as its colour. */
  #colour(layer: string): PaintSpec | null {
    const stops = PAINT_PATTERN.flat.exec(layer)?.[1];
    const flat = stops === undefined ? [] : this.#split.split(stops, CSS_SEPARATOR.comma);
    const [first = "", second] = flat;

    return flat.length === PAINT_WRITE.flatStops && first === second ? this.#paints.of(first) : this.#paints.of(layer);
  }

  /** design_read's fit: contain is FIT, a repeat TILE, cover (or nothing) FILL. */
  #scale(rest: string): (typeof INTENT_SCALE_MODE)[keyof typeof INTENT_SCALE_MODE] {
    if (rest.includes(PAINT_WRITE.contain)) {
      return INTENT_SCALE_MODE.FIT;
    }

    return PAINT_PATTERN.repeat.test(rest) ? INTENT_SCALE_MODE.TILE : INTENT_SCALE_MODE.FILL;
  }

  /** Why a layer cannot be written, and what to do instead. */
  #refusal(
    attribute: string,
    layer: string,
    value: string,
  ): [string, string?] {
    const image = this.#urls.image(layer);

    if (image !== null && PAINT_WRITE.error in image) {
      return [image.error, image.hint];
    }

    if (image !== null) {
      return [PAINT_ERROR.textImage, PAINT_ERROR.colourHint];
    }

    if (layer.includes(PAINT_WRITE.gradient)) {
      return attribute === CSS_PROPERTY.background
        ? [PAINT_ERROR.gradient(layer), PAINT_ERROR.gradientHint]
        : [PAINT_ERROR.textGradient, PAINT_ERROR.colourHint];
    }

    return [PAINT_ERROR.notPaint(attribute, value)];
  }
}
