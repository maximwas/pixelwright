import { splitTop } from "../../css-mapping/values/css-values.ts";
import { px } from "../../css-mapping/values/format.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";

/**
 * What an exported asset keeps of its CSS: where it sits and how big it is. The file holds how it looks, its opacity,
 * blur and inner shadows included, so CSS must not apply them a second time.
 */
const PLACEMENT: ReadonlySet<string> = new Set([
  "position",
  "left",
  "top",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "flex",
  "align-self",
  "transform",
]);

/** An image render is clipped to its own box: corners, drop shadows and outlines outside it stay CSS around it. */
const IMAGE_KEEPS: ReadonlySet<string> = new Set([...PLACEMENT, "border-radius", "box-shadow", "outline"]);

/**
 * An asset's CSS: what it keeps of the layer's, placed where its file goes. Figma exports a turned or mirrored layer
 * already turned, so the asset takes the box it covers and no transform; an icon is exported with what it draws outside
 * its geometry (centred and outside strokes), so it takes that box. An image keeps only its outside (drop) shadows: the
 * inner ones are in the file.
 */
export function assetCss(
  node: SnapshotNode,
  parent: SnapshotNode | null,
  kind: "icon" | "image",
  properties: readonly [string, string][],
): [string, string][] {
  const keeps = kind === "icon" ? PLACEMENT : IMAGE_KEEPS;
  const outside = properties
    .filter(([property]) => keeps.has(property))
    .map(([property, value]): [string, string] =>
      property === "box-shadow" ? [property, outsideShadows(value)] : [property, value],
    )
    .filter(([, value]) => value !== "");
  const bounds = kind === "icon" ? (node.renderBounds ?? node.bounds) : node.bounds;

  if (bounds === undefined) {
    return outside;
  }

  const placed = new Map(outside.filter(([property]) => property !== "transform"));

  placed.set("width", px(bounds.width));
  placed.set("height", px(bounds.height));

  if (placed.has("left") && parent !== null) {
    placed.set("left", px(bounds.x - parent.x));
  }

  if (placed.has("top") && parent !== null) {
    placed.set("top", px(bounds.y - parent.y));
  }

  return outside
    .filter(([property]) => placed.has(property))
    .map(([property]) => [property, placed.get(property) ?? ""]);
}

/** A box-shadow list without its inset shadows (split at the commas between shadows, not inside a colour). */
function outsideShadows(value: string): string {
  return splitTop(value, ",")
    .filter((shadow) => !shadow.startsWith("inset"))
    .join(", ");
}
