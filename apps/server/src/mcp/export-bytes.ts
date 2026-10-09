import { BridgeError, EXPORT_CHUNK_BYTES, OPERATION_SCHEMAS, type OperationInput } from "@pixelwright/core";
import { resolveTarget } from "../bridge/target.ts";
import type { BridgeView } from "../types/mcp.ts";

export type ExportRequest = Omit<OperationInput<"export">, "offset" | "length">;

export interface ExportOptions {
  readonly file?: string | undefined;
  /** Sees the first chunk before the rest are asked for; throwing stops the export there. */
  readonly onFirstChunk?: (first: Buffer, totalBytes: number) => void;
}

/** A node's export, asked for in chunks that each fit one bridge message, and put back together. */
export async function exportBytes(
  bridge: BridgeView,
  request: ExportRequest,
  { file, onFirstChunk }: ExportOptions = {},
): Promise<Buffer> {
  // One target for every chunk: the user may switch the active file between two of them.
  const target = resolveTarget(bridge.plugins(), file);
  const chunks: Buffer[] = [];
  let received = 0;
  let total: number | null = null;

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
      onFirstChunk?.(bytes, total);
    }

    chunks.push(bytes);
    received += bytes.length;
  }

  return Buffer.concat(chunks, received);
}
