import { extname, resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  BridgeError,
  classify,
  designXml,
  OPERATION_SCHEMAS,
  type PlannedAsset,
  type Snapshot,
  type SnapshotNode,
  slug,
} from "@pixelwright/core";
import type * as z from "zod";
import { fetchAsset } from "../../assets/fetch-asset.ts";
import { writeAssets } from "../../assets/write-assets.ts";
import { resolveTarget } from "../../bridge/target.ts";
import { READ_ONLY_ANNOTATIONS } from "../../constants/mcp.ts";
import { AssetsExportInputSchema, AssetsExportOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { describeError } from "../describe-error.ts";
import { registerTool } from "../register-tool.ts";

type AssetsExportArgs = z.output<typeof AssetsExportInputSchema>;
type AssetsExport = z.output<typeof AssetsExportOutputSchema>;
type Target = { session: string };

export function registerAssetsTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "assets_export",
    title: "Export assets",
    description:
      "Writes files out of the design into dir. nodes: up to 50 layers, one file each (SVG for an icon, PNG at 2x otherwise, or the format and scale given; PDF too). from: every true asset inside one layer, the icons and images design_read would plan. original: the images as they were placed instead of renders (photos at full size, in their own format). The same bytes are written once, a name taken by other bytes gets -2, and a file already in dir is never overwritten with other bytes. A layer that cannot be exported is reported in errors and the rest are still written.",
    input: AssetsExportInputSchema,
    output: AssetsExportOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => exportAssets(bridge, args),
  });
}

export async function exportAssets(bridge: ToolContext["bridge"], args: AssetsExportArgs): Promise<AssetsExport> {
  const { nodes, from, dir, original, file } = args;

  if ((nodes === undefined) === (from === undefined)) {
    throw new BridgeError("OP_FAILED", "Give nodes or from: the layers to write, or one layer to write the assets of.");
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
      fetched.set(asset, await fetchAsset(bridge, asset, target));
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
  );

  return {
    files: written.map(({ node, kind, src, bytes }) => ({
      node,
      kind,
      format: formatOf(src),
      path: src,
      bytes,
    })),
    errors,
  };
}

/** One file per named layer; a layer that cannot be read goes to errors and the rest go on. */
async function planLayers(
  bridge: ToolContext["bridge"],
  nodes: readonly string[],
  { dir, format, scale, original }: AssetsExportArgs,
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

      planned.push({
        node,
        kind: chosen === "SVG" ? "icon" : "image",
        format: chosen,
        src: `${dir}/${slug(root.name)}.${chosen.toLowerCase()}`,
        ...(scale === undefined || chosen === "SVG" || chosen === "PDF" ? {} : { scale }),
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
  const { assets } = designXml(snapshot, { assetsPath: dir });

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
