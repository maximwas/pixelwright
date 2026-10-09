import { BridgeError, EXPORT_CHUNK_BYTES, OPERATION_SCHEMAS, type OperationInput } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { BridgeView } from "../types/mcp.ts";

export type ExportRequest = Omit<OperationInput<"export">, "offset" | "length">;

export interface ExportOptions {
  readonly file?: string | undefined;
  /** The plugin session to ask, when the caller resolved it already (several exports from one read). */
  readonly target?: { session: string } | undefined;
  /** Sees the first chunk and the scale it was rendered at before the rest are asked for; throwing stops there. */
  readonly onFirstChunk?: (first: Buffer, scale: number) => void;
}

/**
 * A node's export, asked for in chunks that each fit one bridge message, and put back together, with the scale the
 * plugin rendered it at (lower than asked when it had to fit maxSide).
 */
export async function exportBytes(
  bridge: BridgeView,
  request: ExportRequest,
  { file, target, onFirstChunk }: ExportOptions = {},
): Promise<{ bytes: Buffer; scale: number }> {
  // One target for every chunk: the user may switch the active file between two of them.
  const session = target ?? resolveTarget(bridge.plugins(), file);
  let scale = request.scale;
  const bytes = await readChunks(
    request.node,
    async (offset) => {
      const answer = OPERATION_SCHEMAS.export.output.parse(
        await bridge.request(
          "export",
          {
            ...request,
            offset,
            length: EXPORT_CHUNK_BYTES,
          },
          session,
        ),
      );

      if (offset === 0) {
        scale = answer.scale;
      }

      return answer;
    },
    (first) => onFirstChunk?.(first, scale),
  );

  return {
    bytes,
    scale,
  };
}

/** An image as it was placed in the file, by its hash: not cropped, filtered or scaled. */
export async function imageBytes(bridge: BridgeView, hash: string, target: { session: string }): Promise<Buffer> {
  return readChunks(`image ${hash}`, async (offset) =>
    OPERATION_SCHEMAS.image.output.parse(
      await bridge.request(
        "image",
        {
          hash,
          offset,
          length: EXPORT_CHUNK_BYTES,
        },
        target,
      ),
    ),
  );
}

/** Asks for chunks from offset 0 until the total is in, checking it does not change on the way. */
async function readChunks(
  what: string,
  ask: (offset: number) => Promise<{ totalBytes: number; bytes: string }>,
  onFirst?: (first: Buffer) => void,
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
      onFirst?.(bytes);
    }

    chunks.push(bytes);
    received += bytes.length;
  }

  return Buffer.concat(chunks, received);
}
