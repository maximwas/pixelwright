import { InjectionToken, inject, injectable } from "@needle-di/core";
import { EDGE_DIFF } from "@/core/images/edge-diff.ts";
import type { EdgeLines } from "@/core/images/images.types.ts";
import { RGBA } from "@/core/images/rgba.ts";
import { RMSE } from "@/core/images/rmse.ts";
import type { PixelImage } from "@/core/ports/image-codec.port.ts";
import { PIXEL_DIFF, type PixelBox, type RgbaImage } from "@/core/ports/pixel-diff.port.ts";

/** Two images compared (T-089), in image_compare's order. */
export interface ImagesCompared {
  readonly rmse: number;
  /** The share of the pixels both cover that differ, 0 to 1. */
  readonly different: number;
  readonly box: PixelBox | null;
  readonly rows: EdgeLines;
  readonly columns: EdgeLines;
  /** The part both cover: the render faded, every differing pixel red. */
  readonly difference: RgbaImage;
}

/**
 * A render against its reference (T-089, S-093): pixel by pixel over the part both cover from the top left, both laid
 * over white (rmse ours, the differing pixels pixelmatch's, A§15.7); and by their edges over the whole of each, so an
 * edge past that part counts as missing or extra (S-094).
 */
@injectable()
export class ImageComparison {
  readonly #rgba;
  readonly #rmse;
  readonly #edges;
  readonly #pixels;

  constructor(
    rgba = inject(RGBA),
    rmse = inject(RMSE),
    edges = inject(EDGE_DIFF),
    pixels = inject(PIXEL_DIFF),
  ) {
    this.#rgba = rgba;
    this.#rmse = rmse;
    this.#edges = edges;
    this.#pixels = pixels;
  }

  compare(node: PixelImage, reference: PixelImage): ImagesCompared {
    const ours = this.#rgba.of(node);
    const theirs = this.#rgba.of(reference);
    const width = Math.min(ours.width, theirs.width);
    const height = Math.min(ours.height, theirs.height);
    const covered = [this.#rgba.topLeft(ours, width, height), this.#rgba.topLeft(theirs, width, height)] as const;
    const { count, box, image } = this.#pixels.compare(...covered);

    return {
      rmse: this.#rmse.of(...covered),
      different: count / (width * height),
      box,
      ...this.#edges.of(theirs, ours),
      difference: image,
    };
  }
}

export const IMAGE_COMPARISON = new InjectionToken<ImageComparison>("ImageComparison");
