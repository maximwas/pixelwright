import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { requireNode } from "../../figma/nodes.ts";

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Blur effects change what is under a layer, or the layer itself, so the region no longer renders the same alone. */
const BLURS = new Set(["LAYER_BLUR", "BACKGROUND_BLUR"]);

/** The layer types whose own fill can cover a region. */
const FILLED = new Set(["FRAME", "COMPONENT", "INSTANCE", "SECTION", "RECTANGLE"]);

/**
 * The smallest layer that renders a region of a layer as the layer's own render shows it: going down through the
 * children that hold the region, with nothing painted after them over it, no mask before them and nothing fading or
 * blurring them, the deepest that covers it with an opaque fill. Rendering it alone gives the same pixels there.
 */
export async function clipCover({ node: id, clip }: OperationInput<"cover">): Promise<OperationOutput<"cover">> {
  const root = await requireNode(id);
  const origin = boxOf(root);
  const placed = (layer: BaseNode) => {
    const own = boxOf(layer) ?? origin;

    return {
      node: layer.id,
      x: (own?.x ?? 0) - (origin?.x ?? 0),
      y: (own?.y ?? 0) - (origin?.y ?? 0),
      width: own?.width ?? 0,
      height: own?.height ?? 0,
    };
  };

  if (origin === null) {
    return placed(root);
  }

  const region = {
    x: origin.x + clip.x,
    y: origin.y + clip.y,
    width: clip.width,
    height: clip.height,
  };

  return placed(contains(origin, region) && plain(root) ? deepestCover(root, region) : root);
}

/** Down from a layer through the children holding the region, the deepest opaque one; the layer when none is. */
function deepestCover(root: BaseNode, region: Box): BaseNode {
  let best = root;
  let current = root;

  for (let next = holder(current, region); next !== null; next = holder(current, region)) {
    current = next;

    if (opaqueOver(current, region)) {
      best = current;
    }
  }

  return best;
}

/** The child holding the region that the region shows alone: nothing after it over the region, no mask before it. */
function holder(parent: BaseNode, region: Box): SceneNode | null {
  const children = ("children" in parent ? (parent.children as readonly BaseNode[]) : []).filter(
    (child): child is SceneNode => child.type !== "PAGE" && child.type !== "DOCUMENT" && (child as SceneNode).visible,
  );
  const index = children.findLastIndex((child) => {
    const box = boxOf(child);

    return box !== null && contains(box, region);
  });
  const child = children[index];

  if (child === undefined || !plain(child)) {
    return null;
  }

  const covered = children.slice(index + 1).some((later) => {
    const painted = paintedBoxOf(later);

    return painted !== null && overlaps(painted, region);
  });
  const masked = children.slice(0, index).some((earlier) => "isMask" in earlier && earlier.isMask);

  return covered || masked ? null : child;
}

/** Shown as it is: not faded, not blended, not blurred, not turned, not a mask. */
function plain(node: BaseNode): boolean {
  const opacity = "opacity" in node ? node.opacity : 1;
  const blend = "blendMode" in node ? node.blendMode : "NORMAL";
  const effects = "effects" in node && Array.isArray(node.effects) ? (node.effects as readonly Effect[]) : [];
  const rotation = "rotation" in node ? node.rotation : 0;

  return (
    opacity === 1 &&
    (blend === "NORMAL" || blend === "PASS_THROUGH") &&
    !effects.some((effect) => effect.visible && BLURS.has(effect.type)) &&
    !(rotation !== undefined && Math.abs(rotation) > 0.001) &&
    !("isMask" in node && node.isMask)
  );
}

/** Its own opaque fill covers the region: a solid paint at full opacity, the region clear of its rounded corners. */
function opaqueOver(node: BaseNode, region: Box): boolean {
  if (!FILLED.has(node.type) || !("fills" in node) || !Array.isArray(node.fills)) {
    return false;
  }

  const solid = (node.fills as readonly Paint[]).some(
    (paint) =>
      paint.type === "SOLID" &&
      (paint.visible ?? true) &&
      (paint.opacity ?? 1) === 1 &&
      (paint.blendMode === undefined || paint.blendMode === "NORMAL"),
  );
  const box = boxOf(node);

  return solid && box !== null && contains(inset(box, radiusOf(node)), region);
}

/** The largest corner radius. */
function radiusOf(node: BaseNode): number {
  const radii: unknown[] = [];

  if ("cornerRadius" in node) {
    radii.push(node.cornerRadius);
  }

  if ("topLeftRadius" in node) {
    radii.push(node.topLeftRadius, node.topRightRadius, node.bottomLeftRadius, node.bottomRightRadius);
  }

  return Math.max(0, ...radii.filter((radius): radius is number => typeof radius === "number"));
}

function boxOf(node: BaseNode): Box | null {
  return "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
}

/** Where a layer paints, its shadows and outside strokes too. */
function paintedBoxOf(node: BaseNode): Box | null {
  return ("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null) ?? boxOf(node);
}

function inset(box: Box, by: number): Box {
  return {
    x: box.x + by,
    y: box.y + by,
    width: box.width - 2 * by,
    height: box.height - 2 * by,
  };
}

/** Whether a box holds the region, give or take float noise. */
function contains(box: Box, region: Box): boolean {
  const noise = 0.01;

  return (
    region.x >= box.x - noise &&
    region.y >= box.y - noise &&
    region.x + region.width <= box.x + box.width + noise &&
    region.y + region.height <= box.y + box.height + noise
  );
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
