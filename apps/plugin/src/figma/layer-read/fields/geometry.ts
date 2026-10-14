import { roundTo } from "@pixelwright/core";
import { boxFrom, type LayerEntry } from "../layer-entry.ts";

/** Rotation, a mirroring transform, the box a turned or mirrored layer covers, and what it draws past its box. */
export function readGeometry(entry: LayerEntry): void {
  const { node, layer, context } = entry;

  entry.put("rotation", layer.rotation, 0);

  const [[a, b], [c, d]] = node.relativeTransform;

  if ((a ?? 1) * (d ?? 1) - (b ?? 0) * (c ?? 0) < 0) {
    entry.set(
      "mirrorTransform",
      [a, b, c, d].map((value) => roundTo(value ?? 0, 4)),
    );
  }

  if (
    (entry.get("rotation") !== undefined || entry.get("mirrorTransform") !== undefined) &&
    node.absoluteBoundingBox !== null
  ) {
    entry.set("bounds", boxFrom(node.absoluteBoundingBox, context));
  }

  const drawn = ("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null) ?? null;
  const own = node.absoluteBoundingBox;

  if (drawn !== null && own !== null && reachesPast(drawn, own)) {
    entry.set("renderBounds", boxFrom(drawn, context));
  }
}

/** Whether a layer draws past its own box by more than half a pixel (centred or outside strokes, shadows). */
function reachesPast(drawn: Rect, own: Rect): boolean {
  return (
    Math.abs(drawn.x - own.x) > 0.5 ||
    Math.abs(drawn.y - own.y) > 0.5 ||
    Math.abs(drawn.width - own.width) > 0.5 ||
    Math.abs(drawn.height - own.height) > 0.5
  );
}
