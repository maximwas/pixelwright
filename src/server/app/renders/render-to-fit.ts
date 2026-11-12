import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EXPORT_PULL, type HeldExport } from "@/server/app/renders/export-pull.ts";
import { type Clip, PNG_RENDER, type PngImage, type RenderSpec } from "@/server/app/renders/png-render.ts";
import { BYTES_TEXT, RENDERS, RENDERS_TEXT } from "@/server/app/renders/renders.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { EXPORT_FORMAT, EXPORT_SCALE } from "@/shared/ops/export/export.constants.ts";

/** An image to return inline, and the line that says what it is. */
export interface InlineImage extends PngImage {
  readonly text: string;
}

/**
 * An image a tool returns inline (T-071): at most 2000 px a side, which the plugin fits by lowering the scale, and
 * 3.5 MiB, which a render too heavy is made again for, at scale x sqrt(limit / size) x 0.9, three renders at most; the
 * text says the full size and why it was scaled down. A clip is cut at the scale asked, never scaled down.
 */
@injectable()
export class RenderToFit {
  readonly #pull;
  readonly #render;

  constructor(pull = inject(EXPORT_PULL), render = inject(PNG_RENDER)) {
    this.#pull = pull;
    this.#render = render;
  }

  async inline(session: PluginSession, spec: RenderSpec): Promise<InlineImage> {
    if (spec.clip !== undefined) {
      return await this.#clip(session, spec, spec.clip);
    }

    let asked = spec.scale;
    let heavy: number | null = null;

    for (let attempt = 1; ; attempt += 1) {
      // One render at a time: each next scale comes from the size of the one before.
      const held = await this.#pull.start(session, {
        node: spec.node,
        format: EXPORT_FORMAT.png,
        scale: asked,
        effects: spec.effects,
        maxSide: LIMITS.inlineImageSidePx,
      });

      if (held.totalBytes <= LIMITS.inlineImageBytes) {
        return this.#fitted(await this.#pull.bytes(session, held), held, spec.scale, heavy);
      }

      if (attempt >= LIMITS.inlineImageAttempts) {
        const size = BYTES_TEXT.megabytes(held.totalBytes);

        throw new PixelwrightError(ERROR_CODE.resultTooLarge, RENDERS_TEXT.tooHeavy(spec.node, size, held.scale));
      }

      heavy = held.totalBytes;

      // The bytes of an image grow with its area, the square of the scale; a tenth less for the estimate's error.
      const estimate = held.scale * Math.sqrt(LIMITS.inlineImageBytes / held.totalBytes) * RENDERS.retryMargin;

      asked = Math.max(EXPORT_SCALE.min, Math.floor(estimate * RENDERS.scaleSteps) / RENDERS.scaleSteps);
    }
  }

  /** The image read, refused when wider than inline allows, with its line: the full size when it was scaled down. */
  #fitted(
    png: Uint8Array,
    held: HeldExport,
    asked: number,
    heavy: number | null,
  ): InlineImage {
    const image = this.#render.image(png, held.scale, held.node);

    this.#refuseWide(image, held.node);

    const why =
      heavy === null
        ? RENDERS_TEXT.fitSide
        : RENDERS_TEXT.fitBytes(BYTES_TEXT.megabytes(LIMITS.inlineImageBytes), BYTES_TEXT.megabytes(heavy));
    const full = (side: number) => Math.round((side / image.scale) * asked);
    const more = image.scale < asked ? RENDERS_TEXT.scaledDown(why, asked, full(image.width), full(image.height)) : "";

    return { ...image, text: RENDERS_TEXT.shot(held.node, image, more) };
  }

  /** A clip at the scale asked: refused when too wide or too heavy to return inline. */
  async #clip(
    session: PluginSession,
    spec: RenderSpec,
    clip: Clip,
  ): Promise<InlineImage> {
    const image = await this.#render.render(session, spec);

    this.#refuseWide(image, spec.node);

    if (image.png.length > LIMITS.inlineImageBytes) {
      const size = BYTES_TEXT.megabytes(image.png.length);

      throw new PixelwrightError(ERROR_CODE.resultTooLarge, RENDERS_TEXT.heavyCut(spec.node, size));
    }

    return { ...image, text: RENDERS_TEXT.clipShot(spec.node, clip, image) };
  }

  /** Refuses a render too big to return inline, naming the scale that would fit. */
  #refuseWide(image: PngImage, node: string): void {
    const side = Math.max(image.width, image.height);

    if (side <= LIMITS.inlineImageSidePx) {
      return;
    }

    const fit = Math.floor((LIMITS.inlineImageSidePx / side) * image.scale * RENDERS.scaleSteps) / RENDERS.scaleSteps;

    throw new PixelwrightError(ERROR_CODE.resultTooLarge, RENDERS_TEXT.tooWide(node, image, fit));
  }
}

export const RENDER_TO_FIT = new InjectionToken<RenderToFit>("RenderToFit");
