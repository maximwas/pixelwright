import { resolve } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import {
  attributeOf,
  BridgeError,
  type DesignElement,
  designHints,
  designMeasurements,
  designMotion,
  designReadOf,
  designTree,
  elementsOf,
  fitPlan,
  OPERATION_SCHEMAS,
} from "@pixelwright/core";
import type * as z from "zod";
import { fetchAsset } from "../assets/fetch-asset.ts";
import { writeAssets } from "../assets/write-assets.ts";
import { memoryFiles, type WrittenFiles } from "../assets/written-files.ts";
import { resolveTarget } from "../bridge/target.ts";
import { type CodeRead, connectSnapshot } from "../code-connect/connect.ts";
import { findTemplates } from "../code-connect/templates.ts";
import { CODE_CONNECT_SHARE } from "../constants/code-connect.ts";
import { takeScreenshot } from "../images/screenshot.ts";
import type { DesignReadInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";

/** The tool's input; `code` may be left out by callers that skip the schema (it is on by default). */
type DesignReadArgs = Omit<z.output<typeof DesignReadInputSchema>, "code"> & { code?: boolean };

/** `project`: the folder whose Code Connect templates render the instances; none, none run. */
export async function readDesign(
  bridge: ToolContext["bridge"],
  { node: asked, depth, assetsDir, screenshot, maxChars, code: runCode = true, file }: DesignReadArgs,
  files: WrittenFiles = memoryFiles(),
  project: string | null = null,
): Promise<CallToolResult> {
  // One file for the whole read: the snapshot and every asset come from the same session.
  const target = resolveTarget(bridge.plugins(), file);
  const node = asked ?? (await selectedLayer(bridge, target));
  const snapshot = OPERATION_SCHEMAS.snapshot.output.parse(
    await bridge.request(
      "snapshot",
      {
        node,
        ...(depth === undefined ? {} : { depth }),
        css: "unmapped",
      },
      target,
    ),
  );

  if (!snapshot.root.visible) {
    throw new BridgeError(
      "OP_FAILED",
      `${node} is hidden in Figma, and a hidden layer is read as a name and a box only: show it, or read a visible one.`,
    );
  }

  const { templates, problems } =
    project === null || !runCode
      ? {
          templates: [],
          problems: [],
        }
      : await findTemplates(project);
  const code =
    templates.length === 0
      ? null
      : connectSnapshot(snapshot.root, templates, Math.floor(maxChars * CODE_CONNECT_SHARE));
  const connected = code?.connected ?? new Map<string, string>();
  const assetsPath = assetsDir ?? "assets";
  // The cuts are made once: the read with the written files' paths must cut the same branches as the planned one. The
  // code of connected instances has taken its share of maxChars first.
  const plan = fitPlan(snapshot, maxChars - (code?.used ?? 0), {
    assetsPath,
    connected,
  });
  let tree = designTree(snapshot, {
    assetsPath,
    connected,
    ...plan,
  });
  let assets: readonly unknown[] = tree.assets.map(({ node: id, kind, src }) => ({
    node: id,
    kind,
    src,
    written: false,
  }));

  if (assetsDir !== undefined) {
    const { srcByKey, written } = await writeAssets(
      tree.assets,
      (asset) => fetchAsset(bridge, asset, target),
      resolve(assetsDir),
      assetsDir,
      files,
    );

    tree = designTree(snapshot, {
      assetsPath,
      assetSrc: srcByKey,
      connected,
      ...plan,
    });
    assets = written;
  }

  const read = designReadOf(tree);
  const hints = [
    ...designHints(snapshot, tree),
    ...(assetsDir === undefined && read.assets.length > 0
      ? [
          `${read.assets.length} assets are planned but not written, so their src names are plans: pass assetsDir to write them with their real names, or take each path assets_export gives (a name holding other bytes gets -2, the same bytes share one file).`,
        ]
      : []),
    ...problems.map((problem) => `Code Connect: ${problem}`),
    ...(code !== null && code.left > 0
      ? [
          `Code Connect: ${code.left} more connected instance${code.left === 1 ? "" : "s"} did not fit maxChars and ${code.left === 1 ? "is" : "are"} read as layers: read their sections on their own.`,
        ]
      : []),
    ...(read.truncated.length > 0
      ? [
          `${read.truncated.length} branches are shown without their children ($truncated or $children): read each with design_read node=<id>.`,
        ]
      : []),
  ];
  const measurements = designMeasurements(snapshot);
  const motion = designMotion(snapshot);
  const content: CallToolResult["content"] = [
    {
      type: "text",
      text: read.xml,
    },
    {
      type: "text",
      text: JSON.stringify({
        node,
        tokens: read.tokens,
        textStyles: read.textStyles,
        fonts: read.fonts,
        assets,
        ...(measurements.length === 0 ? {} : { measurements }),
        ...(motion === null ? {} : { motion }),
        hints,
        truncated: read.truncated,
        ...(code === null ? {} : codeOutput(code, tree.root, node)),
      }),
    },
  ];

  if (screenshot) {
    const shot = await takeScreenshot(
      bridge,
      {
        node,
        scale: 1,
        effects: true,
      },
      target,
    );

    content.push(...shot.content);
  }

  return { content };
}

/** The one layer the user selected, when no node is named. */
async function selectedLayer(bridge: ToolContext["bridge"], target: { session: string }): Promise<string> {
  const { nodes } = OPERATION_SCHEMAS.selection.output.parse(await bridge.request("selection", null, target));
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

/**
 * The code of the connected instances the read shows ($code, and the read's own layer): instances with the same code
 * once, with their ids; the errors of the layers it shows, once per template; the imports once each.
 */
function codeOutput(code: CodeRead, root: DesignElement | null, layer: string) {
  const elements = elementsOf(root);
  const present = new Set(elements.map(({ id }) => id));
  const shown = new Set([
    layer,
    ...elements.filter((element) => attributeOf(element, "$code") !== undefined).map(({ id }) => id),
  ]);
  const codeComponents = code.components
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) => shown.has(id)),
    }))
    .filter((group) => group.ids.length > 0);
  const codeErrors = code.errors
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) => present.has(id)),
    }))
    .filter((group) => group.ids.length > 0);

  return {
    codeComponents,
    ...(codeErrors.length === 0 ? {} : { codeErrors }),
    imports: [...new Set(codeComponents.flatMap((group) => group.imports))],
  };
}
