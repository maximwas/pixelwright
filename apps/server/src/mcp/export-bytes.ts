import { BridgeError, EXPORT_CHUNK_BYTES, OPERATION_SCHEMAS, type OperationInput } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { BridgeView } from "../types/mcp.ts";

export type ExportRequest = Omit<OperationInput<"export">, "offset" | "length">;

export interface ExportOptions {
  readonly file?: string | undefined;
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
  { file, onFirstChunk }: ExportOptions = {},
): Promise<{ bytes: Buffer; scale: number }> {
  // One target for every chunk: the user may switch the active file between two of them.
  const target = resolveTarget(bridge.plugins(), file);
  const chunks: Buffer[] = [];
  let received = 0;
  let total: number | null = null;
  let scale = request.scale;

  while (total === null || received < total) {
    const answer = OPERATION_SCHEMAS.export.output.parse(
      await bridge.request(
        "export",
        {
          ...request,
          offset: received,
          length: EXPORT_CHUNK_BYTES,
        },
        target,
      ),
    );
    const bytes = Buffer.from(answer.bytes, "base64");

    if (total !== null && answer.totalBytes !== total) {
      throw new BridgeError("OP_FAILED", `${request.node} changed while it was being exported: try again.`);
    }

    if (bytes.length === 0 && received < answer.totalBytes) {
      throw new BridgeError("OP_FAILED", `The plugin sent an empty part of ${request.node}'s export: try again.`);
    }

    if (total === null) {
      total = answer.totalBytes;
      scale = answer.scale;
      onFirstChunk?.(bytes, scale);
    }

    chunks.push(bytes);
    received += bytes.length;
  }

  return {
    bytes: Buffer.concat(chunks, received),
    scale,
  };
}
