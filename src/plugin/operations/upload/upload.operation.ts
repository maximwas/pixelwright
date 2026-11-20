import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FIGMA_BASE64 } from "@/plugin/adapters/figma/figma-base64.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { UPLOAD_STORE } from "@/plugin/app/streams/upload-store.ts";
import type { uploadOp } from "@/shared/ops/upload/upload.manifest.ts";

type UploadInput = zod.output<typeof uploadOp.input>;
type UploadOutput = zod.output<typeof uploadOp.output>;

/** A part of a file design_apply writes from (P-030), held until the apply that makes its image. */
@injectable()
export class UploadOperation extends Operation<UploadInput, UploadOutput> {
  readonly #uploads;
  readonly #base64;

  constructor(
    report = inject(OP_REPORT),
    uploads = inject(UPLOAD_STORE),
    base64 = inject(FIGMA_BASE64),
  ) {
    super(report);
    this.#uploads = uploads;
    this.#base64 = base64;
  }

  protected execute({ stream, offset, chunk, total }: UploadInput): Promise<UploadOutput> {
    const bytes = this.#base64.decode(chunk);

    return Promise.resolve({ received: this.#uploads.receive({ stream, offset, bytes, total }) });
  }
}
