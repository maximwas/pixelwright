import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { requireNode } from "./nodes.ts";

/** The export the server is reading chunk by chunk; dropped once its last chunk is sent. */
let current: { key: string; bytes: Uint8Array } | null = null;

/**
 * One chunk of a layer's export. The first chunk (offset 0) always renders afresh, so a layer changed since the last
 * export is never served stale; the later ones come from memory.
 */
export async function exportNode(input: OperationInput<"export">): Promise<OperationOutput<"export">> {
  const { node: id, format, scale, effects, offset, length } = input;
  const key = JSON.stringify([id, format, scale, effects]);

  if (offset === 0 || current?.key !== key) {
    current = {
      key,
      bytes: await render(id, format, scale, effects),
    };
  }

  const { bytes } = current;
  const end = Math.min(offset + length, bytes.length);

  if (end >= bytes.length) {
    current = null;
  }

  return {
    totalBytes: bytes.length,
    bytes: figma.base64Encode(bytes.subarray(offset, end)),
  };
}

async function render(
  id: string,
  format: OperationInput<"export">["format"],
  scale: number,
  effects: boolean,
): Promise<Uint8Array> {
  const node = await requireNode(id);

  if (!("exportAsync" in node)) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${node.type.toLowerCase()}, which cannot be exported.`);
  }

  // useAbsoluteBounds: the layer's own box, without the shadows and outside strokes that make it bigger.
  const settings: ExportSettings =
    format === "SVG"
      ? {
          format,
          useAbsoluteBounds: !effects,
        }
      : {
          format,
          constraint: {
            type: "SCALE",
            value: scale,
          },
          useAbsoluteBounds: !effects,
        };

  return node.exportAsync(settings);
}
