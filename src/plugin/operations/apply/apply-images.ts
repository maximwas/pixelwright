import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { UPLOAD_STORE } from "@/plugin/app/streams/upload-store.ts";
import { APPLY_TEXT } from "@/plugin/operations/apply/apply.constants.ts";

/** A file as a paint or an asset names it: its path, and the stream its bytes were uploaded under. */
interface ImageFile {
  readonly src?: string;
  readonly stream?: string;
}

/**
 * The images a call's files make (T-131), of what the server uploaded before the apply: each made once per file,
 * before its layer is written, so a file Figma refuses (too big, not PNG, JPEG or GIF) writes nothing.
 */
@injectable()
export class ApplyImages {
  readonly #uploads;
  readonly #factory;
  readonly #made = new Map<string, string>();

  constructor(uploads = inject(UPLOAD_STORE), factory = inject(LAYER_FACTORY)) {
    this.#uploads = uploads;
    this.#factory = factory;
  }

  /** The hash of the image the file makes. */
  hash({ src, stream }: ImageFile): string {
    const made = stream === undefined ? undefined : this.#made.get(stream);

    if (made !== undefined) {
      return made;
    }

    const bytes = stream === undefined ? undefined : this.#uploads.bytes(stream);

    if (stream === undefined || bytes === undefined) {
      throw new WriteError(APPLY_TEXT.notReached(src ?? ""), APPLY_TEXT.notReachedHint);
    }

    const { hash } = this.#factory.image(bytes);

    this.#made.set(stream, hash);
    // shortcut: an upload goes once its image is made; one only a refused element named waits out its 5 minutes.
    this.#uploads.drop(stream);

    return hash;
  }
}

export const APPLY_IMAGES = new InjectionToken<ApplyImages>("ApplyImages");
