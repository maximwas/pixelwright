import { TEXT_TYPES, VECTOR_TYPES } from "../../constants/css.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";

/** Paints CSS cannot draw: a leaf filled with one is rendered as an image (gradients stay CSS, read-only for now). */
const RENDERED_PAINTS: ReadonlySet<string> = new Set(["VIDEO", "PATTERN", "SHADER"]);

/** Effects CSS cannot draw: a leaf with one is rendered as an image. */
const RENDERED_EFFECTS: ReadonlySet<string> = new Set(["NOISE", "TEXTURE", "GLASS", "SHADER"]);

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

/** A layer drawn whole as a picture: a mask group, an image, or what CSS cannot draw. */
const RENDERED: Classified = {
  kind: "image",
  format: "PNG",
};

/** A layer drawn whole as a vector file. */
const VECTOR: Classified = {
  kind: "icon",
  format: "SVG",
};

/**
 * Whether a layer is a true asset, exported whole: what the designer marked for export as SVG, or as a raster when it
 * holds no text (a raster export with text is a screen's preview, read as layers), a mask group, a leaf whose fill is
 * an image or something CSS cannot draw, a vector, or a group drawn only with vector shapes. Everything else is CSS.
 * The read's root is never an asset because of its export settings: reading it asks for what is inside.
 */
export function classify(node: SnapshotNode, root: SnapshotNode | null = null): Classified | null {
  const exported = exportedAs(node, root);

  if (exported !== null) {
    return exported;
  }

  const children = visibleChildren(node);

  // Figma's mask group: the mask at the bottom clips everything above it, so the group is one picture; a frame or
  // section with text over a mask is still a layout, and the read's root is always read inside.
  if (children[0]?.isMask && node !== root && (node.type === "GROUP" || !hasText(node))) {
    return RENDERED;
  }

  if (children.length === 0 && node.childCount === 0 && (hasImageFill(node) || needsRender(node))) {
    return RENDERED;
  }

  return VECTOR_TYPES.has(node.type) || (DRAWING_CONTAINERS.has(node.type) && isDrawing(node)) ? VECTOR : null;
}

/** What the designer's export settings make of a layer: nothing for a PDF, the read's root or a layer with text. */
function exportedAs(node: SnapshotNode, root: SnapshotNode | null): Classified | null {
  const [setting] = node.exportSettings ?? [];

  // A PDF is no web asset; a layer with text is a screen or section someone exports a preview of.
  if (setting === undefined || setting.format === "PDF" || node === root || hasText(node)) {
    return null;
  }

  return {
    kind: setting.format === "SVG" ? "icon" : "image",
    format: setting.format,
    ...(setting.constraint?.type === "SCALE" && setting.constraint.value !== 1
      ? { scale: setting.constraint.value }
      : {}),
  };
}

/** Whether a layer holds text; a branch the snapshot cut may, so it counts as holding some. */
function hasText(node: SnapshotNode): boolean {
  if (TEXT_TYPES.has(node.type) || (node.children === undefined && node.childCount > 0)) {
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
    fills.some((paint) => (paint.visible ?? true) && RENDERED_PAINTS.has(paint.type)) ||
    (node.effects ?? []).some((effect) => (effect.visible ?? true) && RENDERED_EFFECTS.has(effect.type))
  );
}

function hasImageFill(node: SnapshotNode): boolean {
  return Array.isArray(node.fills) && node.fills.some((paint) => paint.type === "IMAGE" && (paint.visible ?? true));
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
