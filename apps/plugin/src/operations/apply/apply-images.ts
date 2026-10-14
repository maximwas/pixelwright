import { WriteError } from "../../figma/write-error.ts";
import type { UploadStore } from "../../services/upload-store.ts";

/** The images a call's files make, from what the server uploaded before the apply. */
export class ApplyImages {
  readonly #uploads: UploadStore;
  readonly #made = new Map<string, Image>();

  constructor(uploads: UploadStore) {
    this.#uploads = uploads;
  }

  /** The bytes an upload brought, once all of them came: a background's image is made of them. */
  bytes(stream: string): Uint8Array | undefined {
    return this.#uploads.bytes(stream);
  }

  /**
   * The image an Image's file makes, made once per file: before its layer, so a file Figma refuses (too big, not PNG,
   * JPEG or GIF) leaves no empty layer behind.
   */
  image(asset: { readonly src: string; readonly stream?: string }): Image {
    const made = asset.stream === undefined ? undefined : this.#made.get(asset.stream);

    if (made !== undefined) {
      return made;
    }

    const bytes = asset.stream === undefined ? undefined : this.#uploads.bytes(asset.stream);

    if (asset.stream === undefined || bytes === undefined) {
      throw new WriteError(`${asset.src} did not reach the plugin.`, "Send it again, or fewer files in one call.");
    }

    const image = figma.createImage(bytes);

    this.#made.set(asset.stream, image);

    return image;
  }
}
