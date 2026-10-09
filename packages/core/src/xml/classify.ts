import { RENDERED_EFFECTS, RENDERED_PAINTS, VECTOR_TYPES } from "../constants/css.ts";
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
 * Whether a layer is a true asset, exported whole: what the designer marked for export as SVG, or as a raster when it
 * holds no text (a raster export with text is a screen's preview, read as layers), a mask group, a leaf whose fill is
 * an image or something CSS cannot draw, a vector, or a group drawn only with vector shapes. Everything else is CSS.
 * The read's root is never an asset because of its export settings: reading it asks for what is inside.
 */
export function classify(node: SnapshotNode, root: SnapshotNode | null = null): Classified | null {
  const [setting] = node.exportSettings ?? [];

  if (setting !== undefined && node !== root && (setting.format === "SVG" || !hasText(node))) {
    return {
      kind: setting.format === "SVG" ? "icon" : "image",
      format: setting.format,
      ...(setting.constraint?.type === "SCALE" && setting.constraint.value !== 1
        ? { scale: setting.constraint.value }
        : {}),
    };
  }

  const children = visibleChildren(node);

  // Figma's mask group: the mask at the bottom clips everything above it, so the group is one picture.
  if (children[0]?.isMask) {
    return {
      kind: "image",
      format: "PNG",
    };
  }

  if (children.length === 0 && node.childCount === 0 && (hasImageFill(node) || needsRender(node))) {
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

/** Whether a layer holds text; a branch the snapshot cut may, so it counts as holding some. */
function hasText(node: SnapshotNode): boolean {
  if (node.type === "TEXT" || (node.children === undefined && node.childCount > 0)) {
    return true;
  }

  return visibleChildren(node).some(hasText);
}

export function visibleChildren(node: SnapshotNode): SnapshotNode[] {
  return (node.children ?? []).filter((child) => child.visible);
}

/** Painted with something CSS cannot draw: video, pattern or shader fills, noise, texture, glass or shader effects. */
function needsRender(node: SnapshotNode): boolean {
  const fills = Array.isArray(node.fills) ? node.fills : [];

  return (
    fills.some((paint) => paint.visible !== false && RENDERED_PAINTS.has(paint.type)) ||
    (node.effects ?? []).some((effect) => effect.visible !== false && RENDERED_EFFECTS.has(effect.type))
  );
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
