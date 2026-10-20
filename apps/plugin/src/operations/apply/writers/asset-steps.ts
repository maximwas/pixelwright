import { type FigmaProps, px } from "@pixelwright/core";
import { hasFills, isSized, refusal } from "../../../figma/capabilities.ts";
import { drawnPast } from "../../../figma/layer-read/fields/geometry.ts";
import type { WriteScope } from "./write-scope.ts";

/**
 * An Image's file: its first image paint takes the new image, keeping how it fits and is cropped; a layer without one
 * gets one that fills it.
 */
export function writeImage(node: SceneNode, props: FigmaProps, scope: WriteScope): void {
  const asset = props.asset;

  if (asset === undefined) {
    return;
  }

  if (!hasFills(node)) {
    throw refusal(node, "fills to hold an image");
  }

  const hash = scope.image(asset).hash;
  const fills: readonly Paint[] = Array.isArray(node.fills) ? node.fills : [];
  const at = fills.findIndex((paint) => paint.type === "IMAGE");

  node.fills =
    at === -1
      ? [
          {
            type: "IMAGE",
            imageHash: hash,
            scaleMode: "FILL",
          },
        ]
      : fills.map((paint, index) =>
          index === at
            ? {
                ...paint,
                imageHash: hash,
              }
            : paint,
        );
}

/**
 * An Icon sized as the XML says by scaling it whole, its lines and corners too (a resize would leave them as they
 * are): by its width when given, else by its height, the drawing keeping its ratio. A new one is measured by its box,
 * an existing one by the box design_read gives it (what it draws past its box included); a size that reads the same
 * scales nothing.
 */
export function fitIcon(node: SceneNode, props: FigmaProps, isNew: boolean): { props: FigmaProps; scaled: boolean } {
  const { width, height, ...rest } = props;
  const box = isNew ? node : (drawnPast(node) ?? node.absoluteBoundingBox ?? node);
  const [wanted, held] =
    typeof width === "number" ? [width, box.width] : typeof height === "number" ? [height, box.height] : [0, 0];
  const scaled = wanted > 0 && held > 0 && px(wanted) !== px(held) && isSized(node);

  if (scaled) {
    node.rescale(wanted / held);
  }

  return {
    props: rest,
    scaled,
  };
}
