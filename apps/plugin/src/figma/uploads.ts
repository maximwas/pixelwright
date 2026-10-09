import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { UPLOAD_STREAMS, UPLOAD_TTL_MS } from "../constants/plugin.ts";

interface Upload {
  readonly bytes: Uint8Array;
  received: number;
  readonly at: number;
}

/** Files on their way in, by stream: the server sends their bytes in chunks before the apply that uses them. */
const uploads = new Map<string, Upload>();

export async function upload({
  stream,
  offset,
  chunk,
  total,
}: OperationInput<"upload">): Promise<OperationOutput<"upload">> {
  const now = Date.now();

  for (const [key, held] of uploads) {
    if (now - held.at > UPLOAD_TTL_MS) {
      uploads.delete(key);
    }
  }

  let held = uploads.get(stream);

  if (held === undefined || held.bytes.length !== total) {
    held = {
      bytes: new Uint8Array(total),
      received: 0,
      at: now,
    };
    uploads.set(stream, held);

    // The oldest go first past the limit.
    for (const key of uploads.keys()) {
      if (uploads.size <= UPLOAD_STREAMS) {
        break;
      }

      uploads.delete(key);
    }
  }

  const bytes = figma.base64Decode(chunk);

  held.bytes.set(bytes.subarray(0, Math.max(0, total - offset)), offset);
  held.received += bytes.length;

  return { received: held.received };
}

/** A complete upload's bytes, or undefined while it is not all there. */
export function uploaded(stream: string): Uint8Array | undefined {
  const held = uploads.get(stream);

  return held !== undefined && held.received >= held.bytes.length ? held.bytes : undefined;
}

/** Streams an apply used, dropped once it is done. */
export function dropUploads(streams: Iterable<string>): void {
  for (const stream of streams) {
    uploads.delete(stream);
  }
}
