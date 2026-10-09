import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { BridgeError } from "@pixelwright/core";
import type * as z from "zod";
import { MAX_IMAGE_SIDE_PX } from "../../constants/mcp.ts";
import { ScreenshotInputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { readPngSize } from "../../utils/png-size.ts";
import { describeError } from "../describe-error.ts";
import { exportBytes } from "../export-bytes.ts";

type ScreenshotArgs = z.output<typeof ScreenshotInputSchema>;

/** No outputSchema on purpose: Claude Code would show the model only structuredContent and drop the image. */
export function registerScreenshotTool(server: McpServer, { bridge }: ToolContext): void {
  // The SDK's overloads take a plain ZodObject, not this one's exact type.
  const inputSchema: z.ZodObject = ScreenshotInputSchema;

  server.registerTool(
    "screenshot",
    {
      title: "Screenshot a layer",
      description: `Renders a layer to PNG so you can see it: a section to build, or your result to check. Returned inline at most ${MAX_IMAGE_SIDE_PX} px on a side: a larger layer comes scaled down to fit, and the text says its full size. For details of a tall layer screenshot one section of it (outline lists them); pass save to write the PNG full size to a file instead.`,
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        return await takeScreenshot(bridge, ScreenshotInputSchema.parse(args));
      } catch (error) {
        throw new Error(describeError(error), { cause: error });
      }
    },
  );
}

export async function takeScreenshot(
  bridge: ToolContext["bridge"],
  { node, scale, effects, save, file }: ScreenshotArgs,
): Promise<CallToolResult> {
  const request = {
    node,
    format: "PNG" as const,
    scale,
    effects,
  };

  if (save !== undefined) {
    const { bytes } = await exportBytes(bridge, request, { file });
    const path = resolve(save);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            node,
            path,
            ...sizeOf(bytes, node),
            bytes: bytes.length,
          }),
        },
      ],
    };
  }

  // The plugin lowers the scale to fit; the check on the first chunk is for what it could not fit.
  const { bytes, scale: used } = await exportBytes(
    bridge,
    {
      ...request,
      maxSide: MAX_IMAGE_SIDE_PX,
    },
    {
      file,
      onFirstChunk: (first, rendered) => assertFitsInline(sizeOf(first, node), node, rendered),
    },
  );
  const { width, height } = sizeOf(bytes, node);
  const full =
    used < scale
      ? ` Scaled down to fit ${MAX_IMAGE_SIDE_PX} px: at scale ${scale} it is ${Math.round((width / used) * scale)}×${Math.round((height / used) * scale)} px; screenshot a section, or pass save, for the details.`
      : "";

  return {
    content: [
      {
        type: "image",
        data: bytes.toString("base64"),
        mimeType: "image/png",
      },
      {
        type: "text",
        text: `Screenshot of ${node}: ${width}×${height} px at scale ${used}.${full}`,
      },
    ],
  };
}

function sizeOf(bytes: Uint8Array, node: string): { width: number; height: number } {
  const size = readPngSize(bytes);

  if (size === null) {
    throw new BridgeError("OP_FAILED", `Figma's export of ${node} is not a PNG.`);
  }

  return size;
}

function assertFitsInline({ width, height }: { width: number; height: number }, node: string, scale: number): void {
  const side = Math.max(width, height);

  if (side <= MAX_IMAGE_SIDE_PX) {
    return;
  }

  const fit = Math.floor((MAX_IMAGE_SIDE_PX / side) * scale * 100) / 100;

  throw new BridgeError(
    "RESULT_TOO_LARGE",
    `${node} renders at ${width}×${height} px at scale ${scale}, over the ${MAX_IMAGE_SIDE_PX} px returned inline: use scale ${fit}, screenshot one section of it (outline lists them), or pass save with a file path to get it full size.`,
  );
}
