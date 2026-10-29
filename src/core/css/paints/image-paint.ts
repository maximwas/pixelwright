import { InjectionToken, inject, injectable } from "@needle-di/core";
import {
  FIGMA_PAINT,
  IMAGE_COVER,
  IMAGE_SCALE,
  PAINTS_TEXT,
  PAINTS_VALUE,
} from "@/core/css/paints/paints.constants.ts";
import type { Paint } from "@/core/css/paints/solid-paint.ts";
import { CSS_URL } from "@/core/css/values/css-url.ts";

/** An image paint as a background layer (C-082): its file, then how the scale mode sizes and repeats it. */
@injectable()
export class ImagePaint {
  readonly #url;

  constructor(url = inject(CSS_URL)) {
    this.#url = url;
  }

  /** The paint's CSS; null when it is no image. */
  css(paint: Paint): string | null {
    if (paint.type !== FIGMA_PAINT.image) {
      return null;
    }

    return PAINTS_TEXT.image(
      this.#url.url(PAINTS_TEXT.asset(paint.imageHash ?? PAINTS_VALUE.image)),
      IMAGE_SCALE[paint.scaleMode ?? PAINTS_VALUE.none] ?? IMAGE_COVER,
    );
  }
}

export const IMAGE_PAINT = new InjectionToken<ImagePaint>("ImagePaint");
