import type { OperationOutput } from "@pixelwright/core";
import { VIEWPORT_MAX_LAYERS } from "./constants.ts";

type ViewportLayer = OperationOutput<"viewport">["layers"][number];

/** What the user sees: the page, the zoom, and the page's layers and their children that meet the view. */
export async function viewport(): Promise<OperationOutput<"viewport">> {
  const { bounds, zoom, center } = figma.viewport;
  const seen = new LayersInView(bounds);

  for (const node of figma.currentPage.children) {
    seen.visit(node, 0);
  }

  return {
    page: figma.currentPage.name,
    zoom,
    center: {
      x: Math.round(center.x),
      y: Math.round(center.y),
    },
    bounds: rounded(bounds),
    layers: seen.layers,
    more: seen.more,
  };
}

/** The visible layers that meet the view, top-level ones and their children, up to the most a viewport lists. */
class LayersInView {
  readonly layers: ViewportLayer[] = [];
  more = false;
  readonly #bounds: Rect;

  constructor(bounds: Rect) {
    this.#bounds = bounds;
  }

  visit(node: SceneNode, level: number): void {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    if (!node.visible || box === null || !meets(box, this.#bounds)) {
      return;
    }

    if (this.layers.length >= VIEWPORT_MAX_LAYERS) {
      this.more = true;

      return;
    }

    this.layers.push({
      id: node.id,
      name: node.name,
      type: node.type,
      box: rounded(box),
    });

    if (level < 1 && "children" in node) {
      for (const child of node.children) {
        this.visit(child, level + 1);
      }
    }
  }
}

/** Whether a box and the view overlap. */
function meets(box: Rect, bounds: Rect): boolean {
  return (
    box.x < bounds.x + bounds.width &&
    box.x + box.width > bounds.x &&
    box.y < bounds.y + bounds.height &&
    box.y + box.height > bounds.y
  );
}

function rounded(box: Rect): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}
