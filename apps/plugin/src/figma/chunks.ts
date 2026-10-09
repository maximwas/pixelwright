/** How many exports may be read at once before the oldest is dropped (and rendered again if asked for). */
const STREAMS = 4;

/**
 * Results the server reads chunk by chunk, one per stream (an id the server gives each export). The first chunk
 * (offset 0) always makes the result afresh, so a layer changed since is never served stale; later chunks of the same
 * stream come from memory, dropped after the last one, and exports read at the same time never mix.
 */
export function chunkSource<T extends { bytes: Uint8Array }>() {
  const streams = new Map<string, T & { key: string }>();

  return async (
    stream: string,
    key: string,
    offset: number,
    length: number,
    make: () => Promise<T>,
  ): Promise<{ result: T; totalBytes: number; chunk: string }> => {
    let result = streams.get(stream);

    if (offset === 0 || result?.key !== key) {
      result = {
        ...(await make()),
        key,
      };
      streams.delete(stream);
      streams.set(stream, result);

      for (const oldest of streams.keys()) {
        if (streams.size <= STREAMS) {
          break;
        }

        streams.delete(oldest);
      }
    }

    const end = Math.min(offset + length, result.bytes.length);

    if (end >= result.bytes.length) {
      streams.delete(stream);
    }

    return {
      result,
      totalBytes: result.bytes.length,
      chunk: figma.base64Encode(result.bytes.subarray(offset, end)),
    };
  };
}
