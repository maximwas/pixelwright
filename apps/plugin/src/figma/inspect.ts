import { type OperationInput, type OperationOutput, roundTo } from "@pixelwright/core";
import { colorProfile } from "./color-profile.ts";
import { pageOf, requireNode } from "./nodes.ts";
import {
  annotationCategories,
  entryOf,
  isLayer,
  type References,
  resolveStyles,
  resolveVariables,
} from "./snapshot.ts";

type Box = { x: number; y: number; width: number; height: number };

/**
 * Layers as Figma has them, each with its parent, its layout box and what it paints, from `relativeTo`'s top left
 * (the page's without it). Reads only: it works while Allow edits is off. An id that is no layer is listed missing.
 */
export async function inspect({ nodes, relativeTo }: OperationInput<"inspect">): Promise<OperationOutput<"inspect">> {
  const originNode = relativeTo === undefined ? null : await requireNode(relativeTo);
  const originBox = originNode !== null && "absoluteBoundingBox" in originNode ? originNode.absoluteBoundingBox : null;
  const origin = {
    x: originBox?.x ?? 0,
    y: originBox?.y ?? 0,
  };
  const relative = (box: Rect | null | undefined): Box | null =>
    box === null || box === undefined
      ? null
      : {
          x: roundTo(box.x - origin.x, 2),
          y: roundTo(box.y - origin.y, 2),
          width: roundTo(box.width, 2),
          height: roundTo(box.height, 2),
        };
  const references: References = {
    styles: new Set(),
    variables: new Map(),
  };
  const categories = await annotationCategories();
  const layers: OperationOutput<"inspect">["layers"] = [];
  const pages = new Set<PageNode | null>();
  const missing: string[] = [];

  for (const id of nodes) {
    const node = await figma.getNodeByIdAsync(id);

    if (node === null || !isLayer(node)) {
      missing.push(id);
      continue;
    }

    pages.add(pageOf(node));

    // Figma's own CSS for what core does not write (a gradient fill), as design_read takes it.
    const entry = await entryOf(node, {
      x: origin.x,
      y: origin.y,
      css: "unmapped",
      references,
      categories,
      whole: true,
    });
    const parent = node.parent;
    const parentLayer = parent !== null && isLayer(parent) ? parent : null;
    const laysOut =
      parentLayer !== null && "layoutMode" in parentLayer && parentLayer.layoutMode !== "NONE" ? parentLayer : null;

    layers.push({
      ...entry,
      parent:
        parent === null
          ? null
          : {
              id: parent.id,
              name: parent.name,
              type: parent.type,
            },
      box: relative(node.absoluteBoundingBox) ?? {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
      },
      paintedBox: relative("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null),
      parentBox: parentLayer === null ? null : relative(parentLayer.absoluteBoundingBox),
      parentPadding:
        laysOut === null
          ? null
          : {
              top: laysOut.paddingTop,
              right: laysOut.paddingRight,
              bottom: laysOut.paddingBottom,
              left: laysOut.paddingLeft,
            },
    });
  }

  return {
    origin:
      originNode === null
        ? null
        : {
            id: originNode.id,
            name: originNode.name,
          },
    layers,
    missing,
    styles: await resolveStyles(references.styles, pages),
    variables: await resolveVariables(references.variables),
    ...colorProfile(),
  };
}
