import {
  BridgeError,
  classify,
  designTree,
  type PlannedAsset,
  type Snapshot,
  type SnapshotNode,
  slug,
} from "@pixelwright/core";
import type * as z from "zod";
import { MAX_EXPORT_SCALE, RASTER_SCALE } from "../../constants/mcp.ts";
import { describeError } from "../../plugin/describe-error.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import type { AssetsExportInputSchema, AssetsExportOutputSchema } from "./schemas.ts";

type AssetsExportArgs = z.output<typeof AssetsExportInputSchema>;
type Errors = z.output<typeof AssetsExportOutputSchema>["errors"];

/** A layer's snapshot as the asset plan reads it: no CSS. */
export async function snapshotOf(session: PluginSession, node: string): Promise<Snapshot> {
  return await session.run("snapshot", {
    node,
    css: "none",
  });
}

/** One file per named layer; a layer that cannot be read goes to errors and the rest go on. */
export async function planLayers(
  session: PluginSession,
  nodes: readonly string[],
  args: AssetsExportArgs,
  errors: Errors,
): Promise<PlannedAsset[]> {
  const planned: PlannedAsset[] = [];

  for (const node of nodes) {
    try {
      const { root } = await snapshotOf(session, node);

      planned.push(...(args.original ? originalsOf(root, node, args.dir, errors) : [renderOf(root, node, args)]));
    } catch (error) {
      errors.push({
        node,
        message: describeError(error),
      });
    }
  }

  return planned;
}

/** A named layer's own images, as placed; none is an error for it. */
function originalsOf(root: SnapshotNode, node: string, dir: string, errors: Errors): PlannedAsset[] {
  const images = originals(root, dir);

  if (images.length === 0) {
    errors.push({
      node,
      message: `${node} has no image fill to take the original of.`,
    });
  }

  return images;
}

/** A named layer rendered: its own export settings count even though it is the root of this read. */
function renderOf(root: SnapshotNode, node: string, { dir, format, scale, width }: AssetsExportArgs): PlannedAsset {
  const asset = classify(root, null);
  const chosen = format ?? defaultFormat(asset?.format);
  const vector = chosen === "SVG" || chosen === "PDF";
  // A vector has no pixels to size: its scale is checked as given.
  const sized = scaleFor(root, node, {
    scale,
    width: vector ? undefined : width,
  });

  return {
    node,
    // An icon stays an icon in any format: rendered with everything it draws, strokes outside its box included.
    kind: asset?.kind ?? (vector && chosen === "SVG" ? "icon" : "image"),
    format: chosen === "WEBP" ? "PNG" : chosen,
    src: `${dir}/${slug(root.name)}.${chosen.toLowerCase()}`,
    ...(sized === undefined || vector ? {} : { scale: sized }),
  };
}

/** The format a layer's own export settings ask for: an SVG or a JPG as they say, else PNG. */
function defaultFormat(own: string | undefined): "SVG" | "JPG" | "PNG" {
  return own === "SVG" ? "SVG" : own === "JPG" ? "JPG" : "PNG";
}

/** A raster's scale: as given, or from a CSS width, density px per CSS px over the layer's own width. */
function scaleFor(
  root: SnapshotNode,
  node: string,
  { scale, width }: { readonly scale: number | undefined; readonly width: number | undefined },
): number | undefined {
  const density = scale ?? RASTER_SCALE;
  const sized = width === undefined ? scale : Math.round(((density * width) / root.width) * 10_000) / 10_000;

  if (sized !== undefined && sized > MAX_EXPORT_SCALE) {
    throw new BridgeError(
      "OP_FAILED",
      `${node} is ${root.width} px wide and Figma renders at most ${MAX_EXPORT_SCALE}× the layer: ${Math.floor((root.width * MAX_EXPORT_SCALE) / density)} px at ${density}x.`,
    );
  }

  return sized;
}

/** Every true asset inside a layer, as design_read plans them; with original, images as placed. */
export function planInside(snapshot: Snapshot, dir: string, original: boolean): PlannedAsset[] {
  const { assets } = designTree(snapshot, { assetsPath: dir });

  if (!original) {
    return assets;
  }

  const layers = new Map<string, SnapshotNode>();
  const walk = (node: SnapshotNode) => {
    layers.set(node.id, node);
    node.children?.forEach(walk);
  };

  walk(snapshot.root);

  return assets.map((asset) => {
    const hash =
      asset.kind === "image" && asset.imageHash === undefined ? imageHashOf(layers.get(asset.node)) : undefined;

    return hash === undefined
      ? asset
      : {
          ...asset,
          imageHash: hash,
        };
  });
}

/** The image fills under a layer, one asset per distinct image, named after the layer holding it. */
function originals(root: SnapshotNode, dir: string): PlannedAsset[] {
  const found = new Map<string, PlannedAsset>();
  const walk = (node: SnapshotNode) => {
    const hash = node.visible ? imageHashOf(node) : undefined;

    if (hash !== undefined && !found.has(hash)) {
      found.set(hash, {
        node: node.id,
        kind: "image",
        format: "PNG",
        src: `${dir}/${slug(node.name)}.png`,
        imageHash: hash,
      });
    }

    node.children?.forEach(walk);
  };

  walk(root);

  return [...found.values()];
}

function imageHashOf(node: SnapshotNode | undefined): string | undefined {
  const fills = Array.isArray(node?.fills) ? node.fills : [];

  return (
    fills.find((paint) => paint.type === "IMAGE" && (paint.visible ?? true) && typeof paint.imageHash === "string")
      ?.imageHash ?? undefined
  );
}
