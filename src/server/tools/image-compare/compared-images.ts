import { InjectionToken, inject, injectable } from "@needle-di/core";
import { IMAGE_CODEC, type PixelImage } from "@/core/ports/image-codec.port.ts";
import { PNG_FILES } from "@/core/ports/png-files.port.ts";
import { PNG_RENDER, type RenderSpec } from "@/server/app/renders/png-render.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";

/** A layer rendered and decoded, with the scale it was rendered at. */
export interface RenderedImage {
  readonly image: PixelImage;
  readonly scale: number;
}

/**
 * image_compare's images (T-089): a layer rendered as screenshot renders it (scale, effects, clip), a reference PNG
 * read from disk, and the difference written to a .png path, each through the ImageCodec port.
 */
@injectable()
export class ComparedImages {
  readonly #render;
  readonly #files;
  readonly #codec;

  constructor(
    render = inject(PNG_RENDER),
    files = inject(PNG_FILES),
    codec = inject(IMAGE_CODEC),
  ) {
    this.#render = render;
    this.#files = files;
    this.#codec = codec;
  }

  async render(session: PluginSession, spec: RenderSpec): Promise<RenderedImage> {
    const { png, scale } = await this.#render.render(session, spec);

    return { image: this.#codec.decode(png), scale };
  }

  async reference(path: string): Promise<PixelImage> {
    return this.#codec.decode(await this.#files.read(path));
  }

  /** Where the difference may go, said before anything renders: a .png path that holds no other file. */
  async checked(path: string): Promise<string> {
    return await this.#files.check(path);
  }

  async write(path: string, image: PixelImage): Promise<void> {
    await this.#files.write(path, this.#codec.encode(image));
  }
}

export const COMPARED_IMAGES = new InjectionToken<ComparedImages>("ComparedImages");
