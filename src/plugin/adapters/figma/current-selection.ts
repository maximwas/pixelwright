import { InjectionToken, injectable } from "@needle-di/core";
import type { NodeRef } from "@/shared/ops/selection/selection.schema.ts";

/** What the user selected on the current page (T-030), each layer with its box in page px, rounded. */
@injectable()
export class CurrentSelection {
  nodes(): NodeRef[] {
    return figma.currentPage.selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      box: this.#box(node),
    }));
  }

  /** absoluteBoundingBox: page coordinates; null for a layer Figma gives none. */
  #box(node: SceneNode): NodeRef["box"] {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    return box === null
      ? null
      : { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
  }
}

export const CURRENT_SELECTION = new InjectionToken<CurrentSelection>("CurrentSelection");
