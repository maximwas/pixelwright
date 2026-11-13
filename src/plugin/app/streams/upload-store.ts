import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { STREAMS_TEXT, UPLOADS } from "@/plugin/app/streams/streams.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** A part of a file the server sends: its bytes from offset, of a file of total bytes, under its stream. */
export interface UploadChunk {
  readonly stream: string;
  readonly offset: number;
  readonly bytes: Uint8Array;
  readonly total: number;
}

interface Upload {
  readonly bytes: Uint8Array;
  /** How many of the file's bytes each chunk brought, by its offset: a chunk sent again counts once. */
  readonly chunks: Map<number, number>;
  readonly at: number;
}

/**
 * Files on their way in, by stream (P-030): the server sends their bytes in chunks before the apply that uses them. A
 * stream is held five minutes, and past 128 MB the oldest go first, never the one coming in: a call may send many
 * files before its apply. A chunk of another total starts its stream again.
 */
@injectable()
export class UploadStore {
  readonly #uploads = new Map<string, Upload>();
  readonly #clock;

  constructor(clock = inject(CLOCK)) {
    this.#clock = clock;
  }

  /** The chunk at its offset; how many of the file's bytes have come. */
  receive({ stream, offset, bytes, total }: UploadChunk): number {
    if (offset >= total) {
      throw new PixelwrightError(ERROR_CODE.opFailed, STREAMS_TEXT.pastEnd(offset, total));
    }

    const now = this.#clock.now();

    this.#expire(now);

    const held = this.#held(stream, total, now);
    const part = bytes.subarray(0, total - offset);

    held.bytes.set(part, offset);
    held.chunks.set(offset, part.length);

    return this.#received(held);
  }

  /** A whole upload's bytes; undefined while some are still to come. */
  bytes(stream: string): Uint8Array | undefined {
    const held = this.#uploads.get(stream);

    return held !== undefined && this.#received(held) >= held.bytes.length ? held.bytes : undefined;
  }

  drop(stream: string): void {
    this.#uploads.delete(stream);
  }

  #expire(now: number): void {
    for (const [stream, held] of this.#uploads) {
      if (now - held.at > UPLOADS.ttlMs) {
        this.#uploads.delete(stream);
      }
    }
  }

  /** The stream's upload; one of another size starts again. */
  #held(
    stream: string,
    total: number,
    now: number,
  ): Upload {
    const held = this.#uploads.get(stream);

    if (held !== undefined && held.bytes.length === total) {
      return held;
    }

    const fresh = { bytes: new Uint8Array(total), chunks: new Map<number, number>(), at: now };

    this.#uploads.set(stream, fresh);
    this.#makeRoom(stream);

    return fresh;
  }

  #makeRoom(incoming: string): void {
    let waiting = [...this.#uploads.values()].reduce((sum, upload) => sum + upload.bytes.length, 0);

    for (const [stream, upload] of this.#uploads) {
      if (waiting <= UPLOADS.maxBytes || stream === incoming) {
        break;
      }

      this.#uploads.delete(stream);
      waiting -= upload.bytes.length;
    }
  }

  #received(upload: Upload): number {
    return [...upload.chunks.values()].reduce((sum, length) => sum + length, 0);
  }
}

export const UPLOAD_STORE = new InjectionToken<UploadStore>("UploadStore");
