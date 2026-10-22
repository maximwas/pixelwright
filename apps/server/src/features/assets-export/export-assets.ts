import { basename, extname, resolve } from "node:path";
import { BridgeError, type PlannedAsset } from "@pixelwright/core";
import type * as z from "zod";
import { fetchAsset } from "../../assets/fetch-asset.ts";
import { WebpEncoder } from "../../assets/webp.ts";
import { writeAssets } from "../../assets/write-assets.ts";
import { memoryFiles, type WrittenFiles } from "../../assets/written-files.ts";
import { WEBP_QUALITY } from "../../constants/mcp.ts";
import { describeError } from "../../plugin/describe-error.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { planInside, planLayers, snapshotOf, withNames } from "./plan-assets.ts";
import type { AssetsExportInputSchema, AssetsExportOutputSchema } from "./schemas.ts";

type AssetsExportArgs = z.output<typeof AssetsExportInputSchema>;
type AssetsExport = z.output<typeof AssetsExportOutputSchema>;

/** The layers named, or the assets inside one, rendered or taken as placed, and written into dir. */
export async function exportAssets(
  plugin: PluginClient,
  args: AssetsExportArgs,
  files: WrittenFiles = memoryFiles(),
  webp: WebpEncoder = new WebpEncoder(),
): Promise<AssetsExport> {
  const { nodes, from, dir, original, file } = args;

  refuseMixedArgs(args);

  // One file for the whole export: the user may switch files while it runs.
  const session = plugin.session(file);
  const errors: AssetsExport["errors"] = [];
  const planned = withNames(
    from === undefined
      ? await planLayers(session, nodes ?? [], args, errors)
      : planInside(await snapshotOf(session, from), dir, original),
    args.names,
  );
  const fetched = await fetchAll(session, planned, {
    errors,
    quality: args.quality,
    webp,
  });
  const { written } = await writeAssets(
    planned.filter((asset) => fetched.has(asset)),
    async (asset) => fetched.get(asset) ?? Buffer.alloc(0),
    {
      dir: resolve(dir),
      srcBase: dir,
      files,
    },
  );

  return answerOf(written, errors, unnamed(args.names, planned, errors));
}

/** The notes for ids names gives a name that no exported layer has; a layer that failed is in errors already. */
function unnamed(
  names: Readonly<Record<string, string>> | undefined,
  planned: readonly PlannedAsset[],
  errors: AssetsExport["errors"],
): string[] {
  const known = new Set([...planned, ...errors].map(({ node }) => node));

  return Object.keys(names ?? {})
    .filter((id) => !known.has(id))
    .map(
      (id) =>
        `names has ${id}, which is not among the layers exported (files[].node gives their ids): no file took its name.`,
    );
}

function refuseMixedArgs({ nodes, from, original, width }: AssetsExportArgs): void {
  if ((nodes === undefined) === (from === undefined)) {
    throw new BridgeError("OP_FAILED", "Give nodes or from: the layers to write, or one layer to write the assets of.");
  }

  if (width !== undefined && (from !== undefined || original)) {
    throw new BridgeError("OP_FAILED", "width is for nodes rendered as PNG, JPG or WEBP: one CSS width per layer.");
  }
}

/** Each planned asset's bytes; one that cannot be had goes to errors and the rest go on. */
async function fetchAll(
  session: PluginSession,
  planned: readonly PlannedAsset[],
  { errors, quality, webp }: { errors: AssetsExport["errors"]; quality: number | undefined; webp: WebpEncoder },
): Promise<Map<PlannedAsset, Buffer>> {
  const fetched = new Map<PlannedAsset, Buffer>();

  for (const asset of planned) {
    try {
      const bytes = await fetchAsset(session, asset);

      // Figma renders PNG; WebP is encoded here.
      fetched.set(asset, extname(asset.src) === ".webp" ? await webp.encode(bytes, quality ?? WEBP_QUALITY) : bytes);
    } catch (error) {
      errors.push({
        node: asset.node,
        message: describeError(error),
      });
    }
  }

  return fetched;
}

function answerOf(
  written: readonly { node: string; kind: PlannedAsset["kind"]; src: string; planned: string; bytes: number }[],
  errors: AssetsExport["errors"],
  notes: readonly string[],
): AssetsExport {
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
    notes: [
      ...renamed.map(
        ({ node, src, planned: wanted }) =>
          `${node} is in ${basename(src)}, not ${basename(wanted)} as planned (the same bytes share one file, a name holding other bytes gets -2): use ${src} in its src.`,
      ),
      ...notes,
    ],
  };
}

/** The format a written file is in, by its extension: originals get theirs from their bytes. */
function formatOf(path: string): string {
  const extension = extname(path).slice(1).toUpperCase();

  return extension === "JPEG" ? "JPG" : extension;
}
