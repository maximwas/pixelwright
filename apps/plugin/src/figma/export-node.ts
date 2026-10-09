import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { chunkSource } from "./chunks.ts";
import { requireNode } from "./nodes.ts";

const exports = chunkSource<{ bytes: Uint8Array; scale: number }>();
const images = chunkSource<{ bytes: Uint8Array }>();

/** One chunk of a layer's export, rendered once per request. */
export async function exportNode(input: OperationInput<"export">): Promise<OperationOutput<"export">> {
  const { node: id, format, effects, offset, length, maxSide } = input;
  const key = JSON.stringify([id, format, input.scale, effects, maxSide]);
  const { result, totalBytes, chunk } = await exports(key, offset, length, () =>
    render(id, format, input.scale, effects, maxSide),
  );

  return {
    scale: result.scale,
    totalBytes,
    bytes: chunk,
  };
}

/** One chunk of an image as it was placed, by its hash: not cropped, filtered or scaled. */
export async function originalImage({
  hash,
  offset,
  length,
}: OperationInput<"image">): Promise<OperationOutput<"image">> {
  const { totalBytes, chunk } = await images(hash, offset, length, async () => {
    const image = figma.getImageByHash(hash);

    if (image === null) {
      throw new BridgeError("OP_FAILED", `No image with hash ${hash} in this file.`);
    }

    return { bytes: await image.getBytesAsync() };
  });

  return {
    totalBytes,
    bytes: chunk,
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
