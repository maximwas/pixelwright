import { VECTOR_TYPES } from "../constants/css.ts";
import type { SnapshotNode } from "../types/snapshot.ts";

/** Shapes an icon may be drawn with, besides true vectors. */
const ICON_SHAPES: ReadonlySet<string> = new Set([
  ...VECTOR_TYPES,
  "ELLIPSE",
  "RECTANGLE",
  "LINE",
  "GROUP",
  "FRAME",
  "INSTANCE",
  "COMPONENT",
]);

/** Containers that are one drawing when everything in them is a vector shape: a logo instance, an icon group. */
const DRAWING_CONTAINERS: ReadonlySet<string> = new Set(["GROUP", "FRAME", "INSTANCE", "COMPONENT"]);

export interface Classified {
  readonly kind: "icon" | "image";
  readonly format: string;
  readonly scale?: number;
}

/**
 * Whether a layer is a true asset, exported whole: what the designer marked for export (in their format), a masked
 * group, a leaf whose fill is an image, a vector, or a group drawn only with vector shapes. Everything else is CSS.
 */
export function classify(node: SnapshotNode): Classified | null {
  const [setting] = node.exportSettings ?? [];

  if (setting !== undefined) {
    return {
      kind: setting.format === "SVG" ? "icon" : "image",
      format: setting.format,
      ...(setting.constraint?.type === "SCALE" && setting.constraint.value !== 1
        ? { scale: setting.constraint.value }
        : {}),
    };
  }

  const children = visibleChildren(node);

  if (children.some((child) => child.isMask)) {
    return {
      kind: "image",
      format: "PNG",
    };
  }

  if (children.length === 0 && node.childCount === 0 && hasImageFill(node)) {
    return {
      kind: "image",
      format: "PNG",
    };
  }

  if (VECTOR_TYPES.has(node.type) || (DRAWING_CONTAINERS.has(node.type) && isDrawing(node))) {
    return {
      kind: "icon",
      format: "SVG",
    };
  }

  return null;
}

export function visibleChildren(node: SnapshotNode): SnapshotNode[] {
  return (node.children ?? []).filter((child) => child.visible);
}

export function hasImageFill(node: SnapshotNode): boolean {
  return Array.isArray(node.fills) && node.fills.some((paint) => paint.type === "IMAGE" && paint.visible !== false);
}

/** A group or frame drawn only with shapes, at least one of them a true vector: no text, image or auto layout. */
function isDrawing(node: SnapshotNode): boolean {
  let vectors = 0;
  const check = (layer: SnapshotNode): boolean => {
    if (layer.children === undefined && layer.childCount > 0) {
      // Cut by the snapshot's budget: what is inside is unknown.
      return false;
    }

    if (!ICON_SHAPES.has(layer.type) || hasImageFill(layer) || (layer.layoutMode !== undefined && layer !== node)) {
      return false;
    }

    if (VECTOR_TYPES.has(layer.type)) {
      vectors += 1;
    }

    return visibleChildren(layer).every(check);
  };

  return (
    node.layoutMode === undefined &&
    visibleChildren(node).length > 0 &&
    visibleChildren(node).every(check) &&
    vectors > 0
  );
}
