import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { requireNode } from "./nodes.ts";

/** The export the server is reading chunk by chunk; dropped once its last chunk is sent. */
let current: { key: string; bytes: Uint8Array; scale: number } | null = null;

/**
 * One chunk of a layer's export. The first chunk (offset 0) always renders afresh, so a layer changed since the last
 * export is never served stale; the later ones come from memory.
 */
export async function exportNode(input: OperationInput<"export">): Promise<OperationOutput<"export">> {
  const { node: id, format, effects, offset, length, maxSide } = input;
  const key = JSON.stringify([id, format, input.scale, effects, maxSide]);

  if (offset === 0 || current?.key !== key) {
    current = {
      key,
      ...(await render(id, format, input.scale, effects, maxSide)),
    };
  }

  const { bytes, scale } = current;
  const end = Math.min(offset + length, bytes.length);

  if (end >= bytes.length) {
    current = null;
  }

  return {
    scale,
    totalBytes: bytes.length,
    bytes: figma.base64Encode(bytes.subarray(offset, end)),
  };
}

async function render(
  id: string,
  format: OperationInput<"export">["format"],
  asked: number,
  effects: boolean,
  maxSide: number | undefined,
): Promise<{ bytes: Uint8Array; scale: number }> {
  const node = await requireNode(id);

  if (!("exportAsync" in node)) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${node.type.toLowerCase()}, which cannot be exported.`);
  }

  const scale = format === "SVG" || maxSide === undefined ? asked : fittedScale(node, asked, effects, maxSide);

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

  return {
    bytes: await node.exportAsync(settings),
    scale,
  };
}

/** The scale asked for, or lower so the rendered box (with its shadows when effects are on) fits maxSide. */
function fittedScale(node: BaseNode, asked: number, effects: boolean, maxSide: number): number {
  const rendered = effects && "absoluteRenderBounds" in node ? node.absoluteRenderBounds : null;
  const box = rendered ?? ("width" in node ? node : null);

  if (box === null) {
    return asked;
  }

  const side = Math.max(box.width, box.height) * asked;

  // Floored to four decimals: Figma rounds the rendered size, and 2000.4 px must not become 2001.
  return side <= maxSide ? asked : Math.floor((maxSide / side) * asked * 10_000) / 10_000;
}
