import { inject, injectable } from "@needle-di/core";
import { IMAGE_COMPARISON } from "@/core/images/image-comparison.ts";
import type { PixelImage } from "@/core/ports/image-codec.port.ts";
import { PROJECT_FOLDER } from "@/server/app/project/project-folder.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { COMPARED_IMAGES } from "@/server/tools/image-compare/compared-images.ts";
import { IMAGE_COMPARE_TEXT } from "@/server/tools/image-compare/image-compare.constants.ts";
import {
  type ImageCompareInput,
  ImageCompareInputSchema,
  type ImageCompareOutput,
} from "@/server/tools/image-compare/image-compare.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * image_compare (T-089): the layer rendered as screenshot renders it, against a PNG (`reference`, relative to the
 * project folder) or another layer rendered the same way (`against`), one of them; core's ImageComparison gives the
 * numbers, and `diff` writes the difference (a bad path said before anything renders). Different sizes compare the
 * part both cover, with a note. Reads only.
 */
@injectable()
export class ImageCompareTool extends Tool<ImageCompareInput, ImageCompareOutput> {
  protected readonly input = ImageCompareInputSchema;
  readonly #session;
  readonly #folder;
  readonly #images;
  readonly #comparison;

  constructor(
    session = inject(PLUGIN_SESSION),
    folder = inject(PROJECT_FOLDER),
    images = inject(COMPARED_IMAGES),
    comparison = inject(IMAGE_COMPARISON),
  ) {
    super();
    this.#session = session;
    this.#folder = folder;
    this.#images = images;
    this.#comparison = comparison;
  }

  protected async run(input: ImageCompareInput): Promise<ImageCompareOutput> {
    const { node, against, scale, effects, clip, diff } = input;
    const path = diff === undefined ? undefined : await this.#images.checked(await this.#folder.resolve(diff));
    const wanted = await this.#wanted(input);
    const rendered = await this.#images.render(this.#session, { node, scale, effects, clip });
    const { difference, ...compared } = this.#comparison.compare(rendered.image, wanted);
    const size = {
      node: IMAGE_COMPARE_TEXT.size(rendered.image.width, rendered.image.height),
      reference: IMAGE_COMPARE_TEXT.size(wanted.width, wanted.height),
    };

    if (path !== undefined) {
      await this.#images.write(path, difference);
    }

    return {
      size,
      scale: rendered.scale,
      ...compared,
      ...(path === undefined ? {} : { diff: path }),
      ...(size.node === size.reference ? {} : { note: this.#note(size, rendered.scale, against) }),
    };
  }

  /** What the layer is compared with: the reference PNG, or the other layer rendered as the layer is. */
  async #wanted({ reference, against, scale, effects, clip }: ImageCompareInput): Promise<PixelImage> {
    if (reference !== undefined && against !== undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, IMAGE_COMPARE_TEXT.both);
    }

    if (against !== undefined) {
      return (await this.#images.render(this.#session, { node: against, scale, effects, clip })).image;
    }

    if (reference === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, IMAGE_COMPARE_TEXT.neither);
    }

    return await this.#images.reference(await this.#folder.resolve(reference));
  }

  /** What a comparison of two sizes covers, and how to make them one. */
  #note(
    size: { node: string; reference: string },
    scale: number,
    against: string | undefined,
  ): string {
    return against === undefined
      ? IMAGE_COMPARE_TEXT.sizesDiffer(size, scale)
      : IMAGE_COMPARE_TEXT.layersDiffer(size, against);
  }
}
