import { InjectionToken, injectable } from "@needle-di/core";
import { STREAMS, STREAMS_TEXT } from "@/plugin/app/streams/streams.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** A part of a held render, and the render's whole size. */
export interface HeldChunk {
  readonly totalBytes: number;
  readonly bytes: Uint8Array;
}

/**
 * Renders the server reads part by part (T-075), one per stream (the id the server gives each export), so exports
 * read at the same time never mix. A render is dropped once its last byte is handed out; past four the oldest goes.
 */
@injectable()
export class ChunkStreams {
  readonly #held = new Map<string, Uint8Array>();

  /** Holds a render under its stream, replacing one held there before; its byte count. */
  hold(stream: string, bytes: Uint8Array): number {
    this.#held.delete(stream);
    this.#held.set(stream, bytes);

    for (const oldest of this.#held.keys()) {
      if (this.#held.size <= STREAMS.held) {
        break;
      }

      this.#held.delete(oldest);
    }

    return bytes.length;
  }

  /** Up to length bytes of a held render from offset; the render is dropped with its last byte. */
  chunk(
    stream: string,
    offset: number,
    length: number,
  ): HeldChunk {
    const bytes = this.#held.get(stream);

    if (bytes === undefined) {
      throw new PixelwrightError(ERROR_CODE.opFailed, STREAMS_TEXT.gone(stream));
    }

    const end = Math.min(offset + length, bytes.length);

    if (end >= bytes.length) {
      this.#held.delete(stream);
    }

    return { totalBytes: bytes.length, bytes: bytes.subarray(offset, end) };
  }
}

export const CHUNK_STREAMS = new InjectionToken<ChunkStreams>("ChunkStreams");
