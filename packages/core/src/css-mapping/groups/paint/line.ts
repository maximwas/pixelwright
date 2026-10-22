import type { ReadScope } from "../../property-group.ts";
import { decimalPx, px } from "../../values/format.ts";
import { paintsCss } from "../../values/paints.ts";
import { readPlacement } from "../geometry/placement.ts";
import { hasLayout } from "../layout/layout.ts";
import { readCentredStroke } from "./strokes.ts";

/**
 * A line is a box with one border: across when it lies flat, down its left side when it stands (within half a degree
 * of a right angle); any other angle is a flat line turned about its centre. A round or square cap reaches past the
 * line's length, which a CSS border's square ends cannot.
 */
export function readLine(scope: ReadScope): void {
  const { node, css } = scope;
  const angle = (((node.rotation ?? 0) % 180) + 180) % 180;
  const standing = Math.abs(angle - 90) <= 0.5;
  const flat = angle <= 0.5 || angle >= 179.5;
  const border = lineBorder(scope);

  if (!standing && !flat) {
    readPlacement(scope);
    css.set("width", px(node.width));
    css.set("border-top", border);
  } else {
    placeLine(scope);
    css.set(standing ? "height" : "width", px(node.width));
    css.set(standing ? "border-left" : "border-top", border);
  }

  if (Array.isArray(node.strokes) && node.strokes.some((paint) => paint.visible ?? true)) {
    readCentredStroke(node, css);
  }

  if (node.strokeCap === "ROUND" || node.strokeCap === "SQUARE") {
    css.readOnly("stroke-linecap", node.strokeCap.toLowerCase());
  }
}

/** The line's stroke as one border: its weight, solid or dashed, and its colour (currentColor when CSS has none). */
function lineBorder({ node, context }: ReadScope): string {
  const color = paintsCss(node.strokes, node.strokeStyleId, node, context);
  const weight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;

  return `${decimalPx(weight)} ${node.dashPattern === undefined ? "solid" : "dashed"} ${typeof color === "string" ? color : "currentColor"}`;
}

/** A flat or standing line placed absolutely by its drawn box's corner, when its parent does not lay it out. */
function placeLine({ node, parent, context, css }: ReadScope): void {
  if (parent === null || node === context.root || !(node.layoutPositioning === "ABSOLUTE" || !hasLayout(parent))) {
    return;
  }

  const box = node.bounds ?? node;

  css.set("position", "absolute");
  css.set("left", px(box.x - parent.x));
  css.set("top", px(box.y - parent.y));
}
