import { InjectionToken, injectable } from "@needle-di/core";
import type { Box, NodeRef } from "@/shared/ops/selection/selection.schema.ts";

/** A layer as lists name it (T-030, T-033): its id, name, Figma type and box in page px, whole pixels. */
@injectable()
export class LayerRefs {
  ref(node: SceneNode): NodeRef {
    // absoluteBoundingBox: page coordinates; null for a layer Figma gives none.
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    return { id: node.id, name: node.name, type: node.type, box: box === null ? null : this.box(box) };
  }

  /** A box in page px, rounded to whole pixels. */
  box(rect: Rect): Box {
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }
}

export const LAYER_REFS = new InjectionToken<LayerRefs>("LayerRefs");
