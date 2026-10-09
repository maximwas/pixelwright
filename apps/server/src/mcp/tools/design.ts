import { resolve } from "node:path";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { BridgeError, designHints, designXml, fitPlan, OPERATION_SCHEMAS, type PlannedAsset } from "@pixelwright/core";
import type * as z from "zod";
import { writeAssets } from "../../assets/write-assets.ts";
import { resolveTarget } from "../../bridge/target.ts";
import { DesignReadInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { describeError } from "../describe-error.ts";
import { exportBytes, imageBytes } from "../export-bytes.ts";
import { takeScreenshot } from "./screenshot.ts";

type DesignReadArgs = z.output<typeof DesignReadInputSchema>;

/** Rasters at 2x, so they stay sharp on high-density screens; vectors as they are. */
const RASTER_SCALE = 2;

/** No outputSchema on purpose: the XML reads best as plain text, and an asked-for screenshot is an image block. */
export function registerDesignTool(server: McpServer, { bridge }: ToolContext): void {
  // The SDK's overloads take a plain ZodObject, not this one's exact type.
  const inputSchema: z.ZodObject = DesignReadInputSchema;

  server.registerTool(
    "design_read",
    {
      title: "Read a design",
      description:
        "Reads a layer (a section, a card, a screen) as Pixelwright's XML: Figma's layer types as tags, Image and Icon for true assets, CSS properties as attributes (var(--Name) where Figma binds a style or variable), ids to read or change a layer later. The first text block is the XML; the second is JSON with tokens (their values), textStyles, fonts, assets (written to assetsDir when given), hints on what the code should bind, and truncated (ids of branches left empty to fit maxChars: read each on its own). A layer with position absolute is placed against its parent element: give that parent position: relative. For a big frame, find its sections with outline first. Rebuild the result with the project's own components and tokens.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        return await readDesign(bridge, DesignReadInputSchema.parse(args));
      } catch (error) {
        throw new Error(describeError(error), { cause: error });
      }
    },
  );
}

export async function readDesign(
  bridge: ToolContext["bridge"],
  { node: asked, depth, assetsDir, screenshot, maxChars, file }: DesignReadArgs,
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

  const assetsPath = assetsDir ?? "assets";
  // The cuts are made once: the read with the written files' paths must cut the same branches as the planned one.
  const plan = fitPlan(snapshot, maxChars, { assetsPath });
  let read = designXml(snapshot, {
    assetsPath,
    ...plan,
  });
  let assets: readonly unknown[] = read.assets.map(({ node: id, kind, src }) => ({
    node: id,
    kind,
    src,
    written: false,
  }));

  if (assetsDir !== undefined) {
    const { srcByKey, written } = await writeAssets(
      read.assets,
      (asset) => fetchAsset(bridge, asset, target),
      resolve(assetsDir),
      assetsDir,
    );

    read = designXml(snapshot, {
      assetsPath,
      assetSrc: srcByKey,
      ...plan,
    });
    assets = written;
  }

  const hints = [
    ...designHints(snapshot, read.xml),
    ...(assetsDir === undefined && read.assets.length > 0
      ? [`${read.assets.length} assets are planned but not written: pass assetsDir to export them.`]
      : []),
    ...(read.truncated.length > 0
      ? [
          `${read.truncated.length} branches are shown without their children ($truncated or $children): read each with design_read node=<id>.`,
        ]
      : []),
  ];
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
        hints,
        truncated: read.truncated,
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

function fetchAsset(bridge: ToolContext["bridge"], asset: PlannedAsset, target: { session: string }): Promise<Buffer> {
  if (asset.imageHash !== undefined) {
    return imageBytes(bridge, asset.imageHash, target);
  }

  const format = asset.format === "JPG" || asset.format === "SVG" || asset.format === "PDF" ? asset.format : "PNG";

  return exportBytes(
    bridge,
    {
      node: asset.node,
      format,
      scale: asset.scale ?? (format === "PNG" || format === "JPG" ? RASTER_SCALE : 1),
      // An icon with everything it draws (centred and outside strokes would be cut off at its box); an image as its own
      // box, its drop shadows and outlines staying CSS around it.
      effects: asset.kind === "icon",
    },
    { target },
  ).then(({ bytes }) => bytes);
}
