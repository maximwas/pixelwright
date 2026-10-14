import { basename, extname, resolve } from "node:path";
import {
  BridgeError,
  classify,
  designTree,
  OPERATION_SCHEMAS,
  type PlannedAsset,
  type Snapshot,
  type SnapshotNode,
  slug,
} from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../bridge/target.ts";
import { MAX_EXPORT_SCALE, RASTER_SCALE, WEBP_QUALITY } from "../constants/mcp.ts";
import { describeError } from "../mcp/describe-error.ts";
import type { AssetsExportInputSchema, AssetsExportOutputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";
import { fetchAsset } from "./fetch-asset.ts";
import { pngToWebp } from "./webp.ts";
import { writeAssets } from "./write-assets.ts";
import { memoryFiles, type WrittenFiles } from "./written-files.ts";

type AssetsExportArgs = z.output<typeof AssetsExportInputSchema>;
type AssetsExport = z.output<typeof AssetsExportOutputSchema>;
type Target = { session: string };

export async function exportAssets(
  bridge: ToolContext["bridge"],
  args: AssetsExportArgs,
  files: WrittenFiles = memoryFiles(),
): Promise<AssetsExport> {
  const { nodes, from, dir, original, file, width, quality } = args;

  if ((nodes === undefined) === (from === undefined)) {
    throw new BridgeError("OP_FAILED", "Give nodes or from: the layers to write, or one layer to write the assets of.");
  }

  if (width !== undefined && (from !== undefined || original)) {
    throw new BridgeError("OP_FAILED", "width is for nodes rendered as PNG, JPG or WEBP: one CSS width per layer.");
  }

  // One file for the whole export: the user may switch files while it runs.
  const target = resolveTarget(bridge.plugins(), file);
  const errors: AssetsExport["errors"] = [];
  const planned =
    from === undefined
      ? await planLayers(bridge, nodes ?? [], args, target, errors)
      : planInside(await snapshotOf(bridge, from, target), dir, original);
  const fetched = new Map<PlannedAsset, Buffer>();

  for (const asset of planned) {
    try {
      const bytes = await fetchAsset(bridge, asset, target);

      // Figma renders PNG; WebP is encoded here.
      fetched.set(asset, extname(asset.src) === ".webp" ? await pngToWebp(bytes, quality ?? WEBP_QUALITY) : bytes);
    } catch (error) {
      errors.push({
        node: asset.node,
        message: describeError(error),
      });
    }
  }

  const ready = planned.filter((asset) => fetched.has(asset));
  const { written } = await writeAssets(
    ready,
    async (asset) => fetched.get(asset) ?? Buffer.alloc(0),
    resolve(dir),
    dir,
    files,
  );

  const renamed = written.filter(({ src, planned: wanted }) => basename(src) !== basename(wanted));

  return {
    files: written.map(({ node, kind, src, planned: wanted, bytes }) => ({
      node,
      kind,
      format: formatOf(src),
      path: src,
      ...(basename(src) === basename(wanted) ? {} : { planned: wanted }),
      bytes,
    })),
    errors,
    notes: renamed.map(
      ({ node, src, planned: wanted }) =>
        `${node} is in ${basename(src)}, not ${basename(wanted)} as design_read plans it (the same bytes share one file, a name holding other bytes gets -2): use ${src} in its src.`,
    ),
  };
}

/** One file per named layer; a layer that cannot be read goes to errors and the rest go on. */
async function planLayers(
  bridge: ToolContext["bridge"],
  nodes: readonly string[],
  { dir, format, scale, original, width }: AssetsExportArgs,
  target: Target,
  errors: AssetsExport["errors"],
): Promise<PlannedAsset[]> {
  const planned: PlannedAsset[] = [];

  for (const node of nodes) {
    try {
      const { root } = await snapshotOf(bridge, node, target);

      if (original) {
        const images = originals(root, dir);

        if (images.length === 0) {
          errors.push({
            node,
            message: `${node} has no image fill to take the original of.`,
          });
        }

        planned.push(...images);
        continue;
      }

      // Named by the user: the layer's own export settings count even though it is the root of this read.
      const asset = classify(root, null);
      const chosen = format ?? (asset?.format === "SVG" ? "SVG" : asset?.format === "JPG" ? "JPG" : "PNG");
      const vector = chosen === "SVG" || chosen === "PDF";
      const density = scale ?? RASTER_SCALE;
      // A CSS width sets the render's: density px per CSS px, so the scale over the layer's own width.
      const sized =
        width === undefined || vector ? scale : Math.round(((density * width) / root.width) * 10_000) / 10_000;

      if (sized !== undefined && sized > MAX_EXPORT_SCALE) {
        throw new BridgeError(
          "OP_FAILED",
          `${node} is ${root.width} px wide and Figma renders at most ${MAX_EXPORT_SCALE}× the layer: ${Math.floor((root.width * MAX_EXPORT_SCALE) / density)} px at ${density}x.`,
        );
      }

      planned.push({
        node,
        // An icon stays an icon in any format: rendered with everything it draws, strokes outside its box included.
        kind: asset?.kind ?? (vector && chosen === "SVG" ? "icon" : "image"),
        format: chosen === "WEBP" ? "PNG" : chosen,
        src: `${dir}/${slug(root.name)}.${chosen.toLowerCase()}`,
        ...(sized === undefined || vector ? {} : { scale: sized }),
      });
    } catch (error) {
      errors.push({
        node,
        message: describeError(error),
      });
    }
  }

  return planned;
}

/** Every true asset inside a layer, as design_read plans them; with original, images as placed. */
function planInside(snapshot: Snapshot, dir: string, original: boolean): PlannedAsset[] {
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
    fills.find((paint) => paint.type === "IMAGE" && paint.visible !== false && typeof paint.imageHash === "string")
      ?.imageHash ?? undefined
  );
}

async function snapshotOf(bridge: ToolContext["bridge"], node: string, target: Target): Promise<Snapshot> {
  return OPERATION_SCHEMAS.snapshot.output.parse(
    await bridge.request(
      "snapshot",
      {
        node,
        css: "none",
      },
      target,
    ),
  );
}

/** The format a written file is in, by its extension: originals get theirs from their bytes. */
function formatOf(path: string): string {
  const extension = extname(path).slice(1).toUpperCase();

  return extension === "JPEG" ? "JPG" : extension;
}
