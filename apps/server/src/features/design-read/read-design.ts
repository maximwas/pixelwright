import { resolve } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import {
  BridgeError,
  type DesignRead,
  type DesignTree,
  designHints,
  designMeasurements,
  designMotion,
  designReadOf,
  designTree,
  fitPlan,
  type Snapshot,
} from "@pixelwright/core";
import type * as z from "zod";
import { fetchAsset } from "../../assets/fetch-asset.ts";
import { writeAssets } from "../../assets/write-assets.ts";
import { memoryFiles, type WrittenFiles } from "../../assets/written-files.ts";
import { type CodeRead, connectSnapshot } from "../../code-connect/connect.ts";
import { findTemplates } from "../../code-connect/templates.ts";
import { CODE_CONNECT_SHARE } from "../../constants/code-connect.ts";
import { takeScreenshot } from "../../images/screenshot.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { codeOutput } from "./code-output.ts";
import type { DesignReadInputSchema } from "./schemas.ts";

/** The tool's input; `code` may be left out by callers that skip the schema (it is on by default). */
type DesignReadArgs = Omit<z.output<typeof DesignReadInputSchema>, "code"> & { code?: boolean };

/** Code Connect's part of a read: the connected instances' code, or none, and what kept the templates from running. */
interface Connected {
  readonly code: CodeRead | null;
  readonly problems: readonly string[];
}

/** `project`: the folder whose Code Connect templates render the instances; none, none run. */
export async function readDesign(
  plugin: PluginClient,
  args: DesignReadArgs,
  files: WrittenFiles = memoryFiles(),
  project: string | null = null,
): Promise<CallToolResult> {
  // One file for the whole read: the snapshot and every asset come from the same session.
  const session = plugin.session(args.file);
  const node = args.node ?? (await selectedLayer(session));
  const snapshot = await visibleSnapshot(session, node, args.depth);
  const connected = await connectedCode(snapshot, args, project);
  const { tree, assets } = await treeWithAssets(session, snapshot, {
    args,
    code: connected.code,
    files,
  });
  const read = designReadOf(tree);
  const content: CallToolResult["content"] = [
    {
      type: "text",
      text: read.xml,
    },
    {
      type: "text",
      text: JSON.stringify(
        readMeta(snapshot, tree, {
          node,
          read,
          assets,
          args,
          connected,
        }),
      ),
    },
  ];

  if (args.screenshot) {
    content.push(
      ...(
        await takeScreenshot(session, {
          node,
          scale: 1,
          effects: true,
        })
      ).content,
    );
  }

  return { content };
}

/** The one layer the user selected, when no node is named. */
async function selectedLayer(session: PluginSession): Promise<string> {
  const { nodes } = await session.run("selection", null);
  const [only] = nodes;

  if (only === undefined || nodes.length > 1) {
    throw new BridgeError(
      "NODE_NOT_FOUND",
      nodes.length === 0
        ? "Nothing is selected in Figma: select one layer, or pass node (outline and nodes_find give ids)."
        : `${nodes.length} layers are selected: select one, or pass node.`,
    );
  }

  return only.id;
}

/** The layer's snapshot; a hidden one is refused, as a hidden layer is read as a name and a box only. */
async function visibleSnapshot(session: PluginSession, node: string, depth: number | undefined): Promise<Snapshot> {
  const snapshot = await session.run("snapshot", {
    node,
    ...(depth === undefined ? {} : { depth }),
    css: "unmapped",
  });

  if (!snapshot.root.visible) {
    throw new BridgeError(
      "OP_FAILED",
      `${node} is hidden in Figma, and a hidden layer is read as a name and a box only: show it, or read a visible one.`,
    );
  }

  return snapshot;
}

/** The code the project's Code Connect templates give the read's connected instances, within their share of maxChars. */
async function connectedCode(snapshot: Snapshot, args: DesignReadArgs, project: string | null): Promise<Connected> {
  const { templates, problems } =
    project === null || !(args.code ?? true)
      ? {
          templates: [],
          problems: [],
        }
      : await findTemplates(project);

  return {
    code:
      templates.length === 0
        ? null
        : connectSnapshot(snapshot.root, templates, Math.floor(args.maxChars * CODE_CONNECT_SHARE)),
    problems,
  };
}

/**
 * The read's tree, its cuts made once (the read with the written files' paths must cut the same branches as the planned
 * one, the connected code having taken its share of maxChars first), and its assets: planned, or written to assetsDir.
 */
async function treeWithAssets(
  session: PluginSession,
  snapshot: Snapshot,
  { args, code, files }: { args: DesignReadArgs; code: CodeRead | null; files: WrittenFiles },
): Promise<{ tree: DesignTree; assets: readonly unknown[] }> {
  const connected = code?.connected ?? new Map<string, string>();
  const assetsPath = args.assetsDir ?? "assets";
  const plan = fitPlan(snapshot, args.maxChars - (code?.used ?? 0), {
    assetsPath,
    connected,
  });
  const tree = designTree(snapshot, {
    assetsPath,
    connected,
    ...plan,
  });

  if (args.assetsDir === undefined) {
    return {
      tree,
      assets: tree.assets.map(({ node, kind, src }) => ({
        node,
        kind,
        src,
        written: false,
      })),
    };
  }

  const { srcByKey, written } = await writeAssets(tree.assets, (asset) => fetchAsset(session, asset), {
    dir: resolve(args.assetsDir),
    srcBase: args.assetsDir,
    files,
  });

  return {
    tree: designTree(snapshot, {
      assetsPath,
      assetSrc: srcByKey,
      connected,
      ...plan,
    }),
    assets: written,
  };
}

/** The read's JSON block: tokens, styles, fonts, assets, measurements, motion, hints, cuts and the connected code. */
function readMeta(
  snapshot: Snapshot,
  tree: DesignTree,
  {
    node,
    read,
    assets,
    args,
    connected,
  }: { node: string; read: DesignRead; assets: readonly unknown[]; args: DesignReadArgs; connected: Connected },
) {
  const measurements = designMeasurements(snapshot);
  const motion = designMotion(snapshot);

  return {
    node,
    tokens: read.tokens,
    textStyles: read.textStyles,
    fonts: read.fonts,
    assets,
    ...(measurements.length === 0 ? {} : { measurements }),
    ...(motion === null ? {} : { motion }),
    hints: hintsOf(snapshot, tree, {
      read,
      assetsDir: args.assetsDir,
      connected,
    }),
    truncated: read.truncated,
    ...(connected.code === null ? {} : codeOutput(connected.code, tree.root, node)),
  };
}

function hintsOf(
  snapshot: Snapshot,
  tree: DesignTree,
  { read, assetsDir, connected }: { read: DesignRead; assetsDir: string | undefined; connected: Connected },
): string[] {
  const left = connected.code?.left ?? 0;

  return [
    ...designHints(snapshot, tree),
    ...(assetsDir === undefined && read.assets.length > 0
      ? [
          `${read.assets.length} assets are planned but not written, so their src names are plans: pass assetsDir to write them with their real names, or take each path assets_export gives (a name holding other bytes gets -2, the same bytes share one file).`,
        ]
      : []),
    ...connected.problems.map((problem) => `Code Connect: ${problem}`),
    ...(left > 0
      ? [
          `Code Connect: ${left} more connected instance${left === 1 ? "" : "s"} did not fit maxChars and ${left === 1 ? "is" : "are"} read as layers: read their sections on their own.`,
        ]
      : []),
    ...(read.truncated.length > 0
      ? [
          `${read.truncated.length} branches are shown without their children ($truncated or $children): read each with design_read node=<id>.`,
        ]
      : []),
  ];
}
