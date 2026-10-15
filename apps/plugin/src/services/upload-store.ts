import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { UPLOAD_BYTES, UPLOAD_TTL_MS } from "../constants/plugin.ts";

interface Upload {
  readonly bytes: Uint8Array;
  /** How many of the file's bytes each chunk brought, by its offset: a chunk sent again counts once. */
  readonly chunks: Map<number, number>;
  readonly at: number;
}

/**
 * Files on their way in, by stream: the server sends their bytes in chunks before the apply that uses them. A stream
 * is kept for a few minutes, and past the size limit the oldest go first, never the one coming in: a call may send
 * many files before its apply.
 */
export class UploadStore {
  readonly #uploads = new Map<string, Upload>();
  readonly #maxBytes: number;
  readonly #ttlMs: number;

  constructor({ maxBytes = UPLOAD_BYTES, ttlMs = UPLOAD_TTL_MS }: { maxBytes?: number; ttlMs?: number } = {}) {
    this.#maxBytes = maxBytes;
    this.#ttlMs = ttlMs;
  }

  receive({ stream, offset, chunk, total }: OperationInput<"upload">): OperationOutput<"upload"> {
    if (offset >= total) {
      throw new BridgeError("OP_FAILED", `upload: a chunk at byte ${offset} starts past the file's ${total} bytes.`);
    }

    const now = Date.now();

    this.#expire(now);

    const held = this.#held(stream, total, now);
    const bytes = figma.base64Decode(chunk).subarray(0, total - offset);

    held.bytes.set(bytes, offset);
    held.chunks.set(offset, bytes.length);

    return { received: receivedOf(held) };
  }

  /** A complete upload's bytes, or undefined while it is not all there. */
  bytes(stream: string): Uint8Array | undefined {
    const held = this.#uploads.get(stream);

    return held !== undefined && receivedOf(held) >= held.bytes.length ? held.bytes : undefined;
  }

  /** Streams an apply used, dropped once it is done. */
  drop(streams: Iterable<string>): void {
    for (const stream of streams) {
      this.#uploads.delete(stream);
    }
  }

  #expire(now: number): void {
    for (const [key, held] of this.#uploads) {
      if (now - held.at > this.#ttlMs) {
        this.#uploads.delete(key);
      }
    }
  }

  /** The stream's upload; one of another size starts again. */
  #held(stream: string, total: number, now: number): Upload {
    const held = this.#uploads.get(stream);

    if (held !== undefined && held.bytes.length === total) {
      return held;
    }

    const fresh = {
      bytes: new Uint8Array(total),
      chunks: new Map<number, number>(),
      at: now,
    };

    this.#uploads.set(stream, fresh);
    this.#makeRoom(stream);

    return fresh;
  }

  #makeRoom(incoming: string): void {
    let waiting = [...this.#uploads.values()].reduce((sum, upload) => sum + upload.bytes.length, 0);

    for (const [key, upload] of this.#uploads) {
      if (waiting <= this.#maxBytes || key === incoming) {
        break;
      }

      this.#uploads.delete(key);
      waiting -= upload.bytes.length;
    }
  }
}

function receivedOf(upload: Upload): number {
  return [...upload.chunks.values()].reduce((sum, length) => sum + length, 0);
}
