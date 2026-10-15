import type { FigmaProps } from "@pixelwright/core";
import { hasFills, isSized, refusal } from "../../../figma/capabilities.ts";
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

/** A new Icon sized as the XML says, scaled with its vectors (a resize would leave them as they are). */
export function fitIcon(node: SceneNode, props: FigmaProps): FigmaProps {
  const { width, height, ...rest } = props;
  const wanted = typeof width === "number" ? width / node.width : typeof height === "number" ? height / node.height : 1;

  if (wanted !== 1 && Number.isFinite(wanted) && wanted > 0 && isSized(node)) {
    node.rescale(wanted);
  }

  return rest;
}
