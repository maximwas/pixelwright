import type { FigmaProps } from "@pixelwright/core";
import type { Layer, WriteContext } from "../types/apply.ts";
import { WriteError } from "./write-error.ts";

/** A file's name without its folder and extension: a new Image's or Icon's layer name when the XML gives none. */
export function fileName(src: string): string {
  return (src.split(/[\\/]/).at(-1) ?? src).replace(/\.[^.]+$/, "");
}

/** The SVG an Icon is drawn from, carried on its change. */
export function svgOf(props: FigmaProps): string {
  const svg = props.asset?.svg;

  if (svg === undefined) {
    throw new WriteError(`${props.asset?.src ?? "The icon's file"} did not reach the plugin.`);
  }

  return svg;
}

/**
 * An Image's file: its first image paint takes the new image, keeping how it fits and is cropped; a layer without one
 * gets one that fills it.
 */
export function writeImage(node: Layer, props: FigmaProps, context: WriteContext): void {
  const asset = props.asset;

  if (asset === undefined) {
    return;
  }

  if (asset.kind === "icon") {
    throw new WriteError("An icon's SVG makes new vector layers: delete the icon and create it again to replace it.");
  }

  const bytes = asset.stream === undefined ? undefined : context.uploads?.(asset.stream);

  if (bytes === undefined) {
    throw new WriteError(`${asset.src} did not reach the plugin.`);
  }

  const hash = figma.createImage(bytes).hash;
  const fills = Array.isArray(node.fills) ? (node.fills as Paint[]) : [];
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
export function fitIcon(node: Layer, props: FigmaProps): FigmaProps {
  const { width, height, ...rest } = props;
  const wanted = typeof width === "number" ? width / node.width : typeof height === "number" ? height / node.height : 1;

  if (wanted !== 1 && Number.isFinite(wanted) && wanted > 0) {
    (node as unknown as FrameNode).rescale(wanted);
  }

  return rest;
}

/** A copy's layers by the source's: walked side by side, as a clone has the source's structure. */
export function pairCopy(source: BaseNode, copy: BaseNode, into: Map<string, BaseNode>, scope: string): void {
  into.set(`${scope} ${source.id}`, copy);

  const sources = "children" in source ? source.children : [];
  const copies = "children" in copy ? copy.children : [];

  sources.forEach((child, index) => {
    const twin = copies[index];

    if (twin !== undefined) {
      pairCopy(child, twin, into, scope);
    }
  });
}

/** Whether a layer comes from a component through an instance (its place and layers are the component's). */
export function insideInstance(node: Layer): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type === "INSTANCE") {
      return true;
    }
  }

  return false;
}
