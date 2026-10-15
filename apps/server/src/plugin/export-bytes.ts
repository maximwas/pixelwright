import { randomUUID } from "node:crypto";
import { BridgeError, EXPORT_CHUNK_BYTES, type OperationInput } from "@pixelwright/core";
import type { PluginSession } from "./plugin-session.ts";

export type ExportRequest = Omit<OperationInput<"export">, "offset" | "length" | "stream">;

/** Sees the first chunk, the scale it was rendered at and the export's size before the rest; throwing stops there. */
export type FirstChunk = (first: Buffer, scale: number, totalBytes: number) => void;

/**
 * A node's export, asked for in chunks that each fit one bridge message, and put back together, with the scale the
 * plugin rendered it at (lower than asked when it had to fit maxSide). Every chunk comes from the session's file.
 */
export async function exportBytes(
  session: PluginSession,
  request: ExportRequest,
  onFirstChunk?: FirstChunk,
): Promise<{ bytes: Buffer; scale: number }> {
  // Its own stream: another export read at the same time never shares this one's render.
  const stream = randomUUID();
  let scale = request.scale;
  const bytes = await readChunks(
    request.node,
    async (offset) => {
      const answer = await session.run("export", {
        ...request,
        offset,
        length: EXPORT_CHUNK_BYTES,
        stream,
      });

      if (offset === 0) {
        scale = answer.scale;
      }

      return answer;
    },
    (first, total) => onFirstChunk?.(first, scale, total),
  );

  return {
    bytes,
    scale,
  };
}

/** An image as it was placed in the file, by its hash: not cropped, filtered or scaled. */
export async function imageBytes(session: PluginSession, hash: string): Promise<Buffer> {
  const stream = randomUUID();

  return readChunks(`image ${hash}`, (offset) =>
    session.run("image", {
      hash,
      offset,
      length: EXPORT_CHUNK_BYTES,
      stream,
    }),
  );
}

/** Asks for chunks from offset 0 until the total is in, checking it does not change on the way. */
async function readChunks(
  what: string,
  ask: (offset: number) => Promise<{ totalBytes: number; bytes: string }>,
  onFirst?: (first: Buffer, totalBytes: number) => void,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let received = 0;
  let total: number | null = null;

  while (total === null || received < total) {
    const answer = await ask(received);
    const bytes = Buffer.from(answer.bytes, "base64");

    if (total !== null && answer.totalBytes !== total) {
      throw new BridgeError("OP_FAILED", `${what} changed while it was being exported: try again.`);
    }

    if (bytes.length === 0 && received < answer.totalBytes) {
      throw new BridgeError("OP_FAILED", `The plugin sent an empty part of ${what}'s export: try again.`);
    }

    if (total === null) {
      total = answer.totalBytes;
      onFirst?.(bytes, total);
    }

    chunks.push(bytes);
    received += bytes.length;
  }

  return Buffer.concat(chunks, received);
}
