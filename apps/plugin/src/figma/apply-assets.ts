import type { FigmaProps } from "@pixelwright/core";
import type { WriteContext } from "../types/apply.ts";
import { instancePath } from "./nodes.ts";
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
 * The image an Image's file makes, made once per file: before its layer, so a file Figma refuses (too big, not PNG,
 * JPEG or GIF) leaves no empty layer behind.
 */
export function imageOf(asset: { readonly src: string; readonly stream?: string }, context: WriteContext): Image {
  const made = asset.stream === undefined ? undefined : context.images.get(asset.stream);

  if (made !== undefined) {
    return made;
  }

  const bytes = asset.stream === undefined ? undefined : context.uploads?.(asset.stream);

  if (asset.stream === undefined || bytes === undefined) {
    throw new WriteError(`${asset.src} did not reach the plugin.`, "Send it again, or fewer files in one call.");
  }

  const image = figma.createImage(bytes);

  context.images.set(asset.stream, image);

  return image;
}

/** A new instance's layers by their ids inside it: another instance's ids of the same component name the same ones. */
export function pairInstance(instance: BaseNode, into: Map<string, BaseNode>, scope: string): void {
  for (const layer of "children" in instance ? instance.children : []) {
    into.set(`${scope} ${instancePath(layer.id)}`, layer);
    pairInstance(layer, into, scope);
  }
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
