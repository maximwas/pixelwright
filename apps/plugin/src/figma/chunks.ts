/**
 * One result the server reads chunk by chunk. The first chunk (offset 0) always makes it afresh, so a layer changed
 * since is never served stale; later chunks of the same request come from memory, dropped after the last one.
 */
export function chunkSource<T extends { bytes: Uint8Array }>() {
  let current: (T & { key: string }) | null = null;

  return async (
    key: string,
    offset: number,
    length: number,
    make: () => Promise<T>,
  ): Promise<{ result: T; totalBytes: number; chunk: string }> => {
    if (offset === 0 || current?.key !== key) {
      current = {
        ...(await make()),
        key,
      };
    }

    const result = current;
    const end = Math.min(offset + length, result.bytes.length);

    if (end >= result.bytes.length) {
      current = null;
    }

    return {
      result,
      totalBytes: result.bytes.length,
      chunk: figma.base64Encode(result.bytes.subarray(offset, end)),
    };
  };
}
