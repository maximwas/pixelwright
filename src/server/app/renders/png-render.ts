import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CROP } from "@/core/images/crop.ts";
import { IMAGE_FORMAT } from "@/core/images/images.constants.ts";
import { IMAGE_CODEC } from "@/core/ports/image-codec.port.ts";
import { IMAGE_SNIFFER } from "@/core/ports/image-sniffer.port.ts";
import { EXPORT_PULL, type ExportRequest, type Rendered } from "@/server/app/renders/export-pull.ts";
import { RENDERS, RENDERS_TEXT } from "@/server/app/renders/renders.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { coverOp } from "@/shared/ops/cover/cover.manifest.ts";
import type { ClipSchema } from "@/shared/ops/cover/cover.schema.ts";
import { EXPORT_FORMAT } from "@/shared/ops/export/export.constants.ts";

/** A region of a layer, in Figma px from its box's top left; a box on the page has the same four numbers. */
export type Clip = zod.output<typeof ClipSchema>;

/** What to render: a layer at a scale, with or without its effects, cut to a clip when one is given. */
export interface RenderSpec {
  readonly node: string;
  readonly scale: number;
  readonly effects: boolean;
  readonly clip?: Clip | undefined;
}

/** A PNG with its size in pixels and the scale it was rendered at. */
export interface PngImage {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/**
 * A layer rendered to PNG at the scale, full size; with a clip, a region of it (T-073): the whole layer rendered, then
 * cut to the clip, measured from the layer's box (the cover op says where that box sits in the render: with effects
 * the render covers what paints around it, and may cover less, as a text's glyphs do; what it does not cover comes
 * out transparent). Past 64 Mpx the smallest opaque layer inside that shows the region alone is rendered instead, at
 * the scale asked (O-014); with none the clip is refused before Figma renders anything.
 */
@injectable()
export class PngRender {
  readonly #pull;
  readonly #codec;
  readonly #sniffer;
  readonly #crop;

  constructor(
    pull = inject(EXPORT_PULL),
    codec = inject(IMAGE_CODEC),
    sniffer = inject(IMAGE_SNIFFER),
    crop = inject(CROP),
  ) {
    this.#pull = pull;
    this.#codec = codec;
    this.#sniffer = sniffer;
    this.#crop = crop;
  }

  async render(session: PluginSession, spec: RenderSpec): Promise<PngImage> {
    if (spec.clip !== undefined) {
      return await this.#clipped(session, spec, spec.clip);
    }

    const { bytes, scale } = await this.#pull.render(session, this.#request(spec, spec.node, spec.effects));

    return this.image(bytes, scale, spec.node);
  }

  /** A PNG's own size, read from its header; an export that is no PNG is an error. */
  image(
    png: Uint8Array,
    scale: number,
    node: string,
  ): PngImage {
    const size = this.#sniffer.sniff(png);

    if (size?.format !== IMAGE_FORMAT.png) {
      throw new PixelwrightError(ERROR_CODE.opFailed, RENDERS_TEXT.notPng(node));
    }

    return { png, width: size.width, height: size.height, scale };
  }

  async #clipped(
    session: PluginSession,
    spec: RenderSpec,
    clip: Clip,
  ): Promise<PngImage> {
    const { node, scale } = spec;
    const { box, rendered, cover } = await session.run(coverOp, { node, clip, effects: spec.effects });

    this.#refuseOutside(node, { box, rendered, clip });

    if (Math.round(clip.width * scale) < 1 || Math.round(clip.height * scale) < 1) {
      throw new PixelwrightError(ERROR_CODE.opFailed, RENDERS_TEXT.underPixel(scale));
    }

    if (!this.#heavy(rendered, scale)) {
      const whole = await this.#pull.render(session, this.#request(spec, node, spec.effects));

      return this.#cut(whole, { ...clip, x: box.x - rendered.x + clip.x, y: box.y - rendered.y + clip.y });
    }

    if (cover.node === node || this.#heavy(cover, scale)) {
      const [width, height] = [Math.round(rendered.width * scale), Math.round(rendered.height * scale)];

      throw new PixelwrightError(ERROR_CODE.resultTooLarge, RENDERS_TEXT.heavyClip(node, width, height, scale));
    }

    // The cover alone, on its own box: nothing paints over the region, so its pixels there are the layer's.
    const section = await this.#pull.render(session, this.#request(spec, cover.node, false));

    return this.#cut(section, { ...clip, x: clip.x - cover.x, y: clip.y - cover.y });
  }

  #request(
    { scale }: RenderSpec,
    node: string,
    effects: boolean,
  ): ExportRequest {
    return { node, format: EXPORT_FORMAT.png, scale, effects };
  }

  /** Whether rendering a box whole at the scale is too much. */
  #heavy(box: Clip, scale: number): boolean {
    return Math.round(box.width * scale) * Math.round(box.height * scale) > RENDERS.clipRenderPx;
  }

  /** The clip lies in the box and what paints around it (T-073), give or take float noise. */
  #refuseOutside(node: string, { box, rendered, clip }: { box: Clip; rendered: Clip; clip: Clip }): void {
    const reach = {
      left: Math.min(0, rendered.x - box.x),
      top: Math.min(0, rendered.y - box.y),
      right: Math.max(box.width, rendered.x - box.x + rendered.width),
      bottom: Math.max(box.height, rendered.y - box.y + rendered.height),
    };
    const within =
      clip.x >= reach.left - RENDERS.edgePx &&
      clip.y >= reach.top - RENDERS.edgePx &&
      clip.x + clip.width <= reach.right + RENDERS.edgePx &&
      clip.y + clip.height <= reach.bottom + RENDERS.edgePx;

    if (within) {
      return;
    }

    const own = reach.left === 0 && reach.top === 0 && reach.right === box.width && reach.bottom === box.height;
    const round = (value: number) => Math.round(value * RENDERS.edgeSteps) / RENDERS.edgeSteps;
    const paints = own
      ? ""
      : RENDERS_TEXT.paints({
        left: round(reach.left),
        top: round(reach.top),
        right: round(reach.right),
        bottom: round(reach.bottom),
      });

    throw new PixelwrightError(ERROR_CODE.opFailed, RENDERS_TEXT.outside(node, box, paints));
  }

  /** A region of a render, in layer px from the render's top left, as a PNG of its own. */
  #cut({ bytes, scale }: Rendered, region: Clip): PngImage {
    const image = this.#crop.region(this.#codec.decode(bytes), {
      x: Math.round(region.x * scale),
      y: Math.round(region.y * scale),
      width: Math.round(region.width * scale),
      height: Math.round(region.height * scale),
    });

    return { png: this.#codec.encode(image), width: image.width, height: image.height, scale };
  }
}

export const PNG_RENDER = new InjectionToken<PngRender>("PngRender");
