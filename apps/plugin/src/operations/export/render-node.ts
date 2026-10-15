import { BridgeError, type OperationInput } from "@pixelwright/core";
import { requireNode } from "../../figma/nodes.ts";

/** How a layer is rendered: its format, the scale asked for, with its effects or its own box, and the longest side. */
export interface RenderRequest {
  readonly format: OperationInput<"export">["format"];
  readonly scale: number;
  readonly effects: boolean;
  readonly maxSide: number | undefined;
}

/** A layer's bytes in a format, and the scale it was rendered at. */
export async function renderNode(id: string, request: RenderRequest): Promise<{ bytes: Uint8Array; scale: number }> {
  const node = await requireNode(id);

  if (!("exportAsync" in node)) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${node.type.toLowerCase()}, which cannot be exported.`);
  }

  const { format, effects, maxSide } = request;
  const vector = format === "SVG" || format === "PDF";
  const scale = vector || maxSide === undefined ? request.scale : fittedScale(node, request.scale, effects, maxSide);

  // useAbsoluteBounds: the layer's own box, without the shadows and outside strokes that make it bigger.
  const settings: ExportSettings =
    format === "SVG" || format === "PDF"
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
