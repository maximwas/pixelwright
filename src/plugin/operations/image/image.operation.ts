import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { CHUNK_STREAMS } from "@/plugin/app/streams/chunk-streams.ts";
import { IMAGE_TEXT } from "@/plugin/operations/image/image.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { imageOp } from "@/shared/ops/image/image.manifest.ts";

type ImageInput = zod.output<typeof imageOp.input>;
type ImageOutput = zod.output<typeof imageOp.output>;

/**
 * An image fill's original bytes by its hash (T-055, T-194), as it was placed: not cropped, filtered or scaled. They
 * are held under the server's stream, and chunk hands them out as it does a render's.
 */
@injectable()
export class ImageOperation extends Operation<ImageInput, ImageOutput> {
  readonly #lookup;
  readonly #streams;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    streams = inject(CHUNK_STREAMS),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#streams = streams;
  }

  protected async execute({ hash, stream }: ImageInput): Promise<ImageOutput> {
    const image = this.#lookup.image(hash);

    if (image === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, IMAGE_TEXT.missing(hash));
    }

    return { totalBytes: this.#streams.hold(stream, await image.getBytesAsync()) };
  }
}
