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
  type OperationOutput,
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
import { codeHints } from "./code-hints.ts";
import { codeOutput } from "./code-output.ts";
import { nearbyNotes } from "./nearby-notes.ts";
import type { DesignReadInputSchema } from "./schemas.ts";

/** The tool's input; `code` (on by default) and `repeats` may be left out by callers that skip the schema. */
type DesignReadArgs = Omit<z.output<typeof DesignReadInputSchema>, "code" | "repeats"> & {
  code?: boolean;
  repeats?: boolean;
};

/** Code Connect's part of a read: the connected instances' code, or none, and what it says of the project's files. */
interface Connected {
  readonly code: CodeRead | null;
  readonly problems: readonly string[];
}

/**
 * `project`: the folder whose Code Connect templates render the instances and a relative assetsDir starts from; none,
 * no templates run and assetsDir starts from the working directory.
 */
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
  const connected = await connectedCode(session, snapshot, args, project);
  const { tree, assets } = await treeWithAssets(session, snapshot, {
    args,
    code: connected.code,
    files,
    project,
  });
  const read = designReadOf(tree);
  const notes = args.nearby === undefined ? null : await nearbyNotes(session, node, args.nearby);
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
          notes,
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

/**
 * The code the project's Code Connect files give the read's connected instances, within their share of maxChars, and
 * what to say of them: the files' problems, the components shown without code, sources gone, an old plugin.
 */
async function connectedCode(
  session: PluginSession,
  snapshot: Snapshot,
  args: DesignReadArgs,
  project: string | null,
): Promise<Connected> {
  if (project === null || !(args.code ?? true)) {
    return {
      code: null,
      problems: [],
    };
  }

  const { templates, problems } = await findTemplates(project);

  if (templates.length === 0) {
    return {
      code: null,
      problems,
    };
  }

  const room = Math.floor(args.maxChars * CODE_CONNECT_SHARE);
  const code = connectSnapshot(snapshot.root, templates, room, session.info()?.file.key ?? null);

  return {
    code,
    problems: [
      ...problems,
      ...(await codeHints(code, {
        templates,
        project,
        node: snapshot.root.id,
      })),
    ],
  };
}

/**
 * The read's tree, its cuts made once (the read with the written files' paths must cut the same branches as the planned
 * one, the connected code having taken its share of maxChars first), and its assets: planned, or written to assetsDir.
 */
async function treeWithAssets(
  session: PluginSession,
  snapshot: Snapshot,
  {
    args,
    code,
    files,
    project,
  }: { args: DesignReadArgs; code: CodeRead | null; files: WrittenFiles; project: string | null },
): Promise<{ tree: DesignTree; assets: readonly unknown[] }> {
  const connected = code?.connected ?? new Map<string, string>();
  const options = {
    assetsPath: args.assetsDir ?? "assets",
    connected,
    repeats: args.repeats ?? false,
  };
  const plan = fitPlan(snapshot, args.maxChars - (code?.used ?? 0), options);
  const tree = designTree(snapshot, {
    ...options,
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
    dir: resolve(project ?? "", args.assetsDir),
    srcBase: args.assetsDir,
    files,
  });

  return {
    tree: designTree(snapshot, {
      ...options,
      assetSrc: srcByKey,
      ...plan,
    }),
    assets: written,
  };
}

/**
 * The read's JSON block: tokens, styles, fonts, assets, measurements, motion, hints, cuts, runs read once, the notes
 * around the screen and the connected code.
 */
function readMeta(
  snapshot: Snapshot,
  tree: DesignTree,
  {
    node,
    read,
    assets,
    args,
    connected,
    notes,
  }: {
    node: string;
    read: DesignRead;
    assets: readonly unknown[];
    args: DesignReadArgs;
    connected: Connected;
    notes: OperationOutput<"nearby"> | null;
  },
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
    ...(read.repeats === undefined ? {} : { repeats: read.repeats }),
    ...(notes === null ? {} : { nearby: notes }),
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
