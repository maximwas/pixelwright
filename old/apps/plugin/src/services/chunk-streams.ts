/** How many exports may be read at once before the oldest is dropped (and rendered again if asked for). */
const STREAMS = 4;

/** Where a chunk starts, and how long it may be. */
export interface ChunkRange {
  readonly offset: number;
  readonly length: number;
}

/**
 * Results the server reads chunk by chunk, one per stream (an id the server gives each export). The first chunk
 * (offset 0) always makes the result afresh, so a layer changed since is never served stale; later chunks of the same
 * stream come from memory, dropped after the last one, and exports read at the same time never mix.
 */
export class ChunkStreams<T extends { bytes: Uint8Array }> {
  readonly #streams = new Map<string, T & { key: string }>();

  async read(
    stream: string,
    key: string,
    { offset, length }: ChunkRange,
    make: () => Promise<T>,
  ): Promise<{ result: T; totalBytes: number; chunk: string }> {
    let result = this.#streams.get(stream);

    if (offset === 0 || result?.key !== key) {
      result = {
        ...(await make()),
        key,
      };
      this.#streams.delete(stream);
      this.#streams.set(stream, result);
      this.#dropOldest();
    }

    const end = Math.min(offset + length, result.bytes.length);

    if (end >= result.bytes.length) {
      this.#streams.delete(stream);
    }

    return {
      result,
      totalBytes: result.bytes.length,
      chunk: figma.base64Encode(result.bytes.subarray(offset, end)),
    };
  }

  #dropOldest(): void {
    for (const oldest of this.#streams.keys()) {
      if (this.#streams.size <= STREAMS) {
        break;
      }

      this.#streams.delete(oldest);
    }
  }
}
