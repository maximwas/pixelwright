import { type OperationInput, type OperationOutput, roundTo, type SnapshotNode } from "@pixelwright/core";
import { colorProfile } from "../../figma/color-profile.ts";
import { annotationCategories } from "../../figma/layer-read/fields/notes.ts";
import { entryOf } from "../../figma/layer-read/read-layer.ts";
import { References } from "../../figma/layer-read/references.ts";
import { isLayer, pageOf, requireNode } from "../../figma/nodes.ts";

type Box = { x: number; y: number; width: number; height: number };
type InspectedLayer = OperationOutput<"inspect">["layers"][number];

/**
 * Layers as Figma has them, each with its parent, its layout box and what it paints, from `relativeTo`'s top left
 * (the page's without it). Reads only: it works while Allow edits is off. An id that is no layer is listed missing.
 */
export async function inspect({ nodes, relativeTo }: OperationInput<"inspect">): Promise<OperationOutput<"inspect">> {
  const originNode = relativeTo === undefined ? null : await requireNode(relativeTo);
  const read = new InspectRead(originNode, await annotationCategories());
  const layers: InspectedLayer[] = [];
  const missing: string[] = [];

  for (const id of nodes) {
    const node = await figma.getNodeByIdAsync(id);

    if (node === null || !isLayer(node)) {
      missing.push(id);
    } else {
      layers.push(await read.layer(node));
    }
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
    styles: await read.references.styles(read.pages),
    variables: await read.references.variables(),
    ...colorProfile(),
  };
}

/** One inspect: the origin its boxes start from, and the pages, styles and variables its layers use. */
class InspectRead {
  readonly references = new References();
  readonly pages = new Set<PageNode | null>();
  readonly #origin: { x: number; y: number };
  readonly #categories: ReadonlyMap<string, string>;

  constructor(originNode: BaseNode | null, categories: ReadonlyMap<string, string>) {
    const originBox =
      originNode !== null && "absoluteBoundingBox" in originNode ? originNode.absoluteBoundingBox : null;

    this.#origin = {
      x: originBox?.x ?? 0,
      y: originBox?.y ?? 0,
    };
    this.#categories = categories;
  }

  /** A layer's entry with its parent, its layout and painted boxes, and the padding of a parent that lays it out. */
  async layer(node: SceneNode): Promise<InspectedLayer> {
    this.pages.add(pageOf(node));

    // Figma's own CSS for what core does not write (a gradient fill), as design_read takes it.
    const entry = await entryOf(node, {
      x: this.#origin.x,
      y: this.#origin.y,
      css: "unmapped",
      references: this.references,
      categories: this.#categories,
      whole: true,
    });
    const parent = node.parent;
    const parentLayer = parent !== null && isLayer(parent) ? parent : null;

    return {
      ...entry,
      parent:
        parent === null
          ? null
          : {
              id: parent.id,
              name: parent.name,
              type: parent.type,
            },
      box: this.#relative(node.absoluteBoundingBox) ?? ownBox(entry),
      paintedBox: this.#relative("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null),
      parentBox: parentLayer === null ? null : this.#relative(parentLayer.absoluteBoundingBox),
      parentPadding: paddingOf(parentLayer),
    };
  }

  #relative(box: Rect | null | undefined): Box | null {
    return box === null || box === undefined
      ? null
      : {
          x: roundTo(box.x - this.#origin.x, 2),
          y: roundTo(box.y - this.#origin.y, 2),
          width: roundTo(box.width, 2),
          height: roundTo(box.height, 2),
        };
  }
}

/** The entry's own box, for a layer Figma gives no bounding box. */
function ownBox(entry: SnapshotNode): Box {
  return {
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height,
  };
}

/** The padding of a parent with auto layout, which places the layer; null for any other parent. */
function paddingOf(parent: SceneNode | null): InspectedLayer["parentPadding"] {
  const laysOut = parent !== null && "layoutMode" in parent && parent.layoutMode !== "NONE" ? parent : null;

  return laysOut === null
    ? null
    : {
        top: laysOut.paddingTop,
        right: laysOut.paddingRight,
        bottom: laysOut.paddingBottom,
        left: laysOut.paddingLeft,
      };
}
