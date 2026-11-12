import { InjectionToken, inject, injectable } from "@needle-di/core";
import { RGBA_LAYOUT, ROUNDING } from "@/core/images/images.constants.ts";
import { RGBA } from "@/core/images/rgba.ts";
import type { RgbaImage } from "@/core/ports/pixel-diff.port.ts";

/** How far apart two images' colours are overall (T-089): image_compare's rmse. */
@injectable()
export class Rmse {
  readonly #rgba;

  constructor(rgba = inject(RGBA)) {
    this.#rgba = rgba;
  }

  /** The root mean square colour difference of two images of one size, 0 to 255 over RGB, both laid over white. */
  of(node: RgbaImage, reference: RgbaImage): number {
    const pixels = node.width * node.height;
    let squares = 0;

    for (let pixel = 0; pixel < pixels; pixel++) {
      for (let channel = 0; channel < RGBA_LAYOUT.colours; channel++) {
        const delta = this.#rgba.overWhite(node, pixel, channel) - this.#rgba.overWhite(reference, pixel, channel);

        squares += delta * delta;
      }
    }

    return Math.round(Math.sqrt(squares / RGBA_LAYOUT.colours / Math.max(1, pixels)) * ROUNDING.rmse) / ROUNDING.rmse;
  }
}

export const RMSE = new InjectionToken<Rmse>("Rmse");
