import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { BridgeError, OPERATION_SCHEMAS } from "@pixelwright/core";
import type * as z from "zod";
import { imageInfo } from "../assets/image-info.ts";
import { resolveTarget } from "../bridge/target.ts";
import {
  EDGE_PX,
  INLINE_ATTEMPTS,
  MAX_CLIP_RENDER_PX,
  MAX_IMAGE_SIDE_PX,
  MAX_INLINE_IMAGE_BYTES,
} from "../constants/mcp.ts";
import { exportBytes } from "../mcp/export-bytes.ts";
import type { ScreenshotInputSchema } from "../schemas/tools.ts";
import type { ToolContext } from "../types/mcp.ts";
import { cropPng } from "../utils/crop-png.ts";

type ScreenshotArgs = z.output<typeof ScreenshotInputSchema>;

export async function takeScreenshot(
  bridge: ToolContext["bridge"],
  { node, scale, effects, save, file, clip, modes }: ScreenshotArgs,
  target?: { session: string },
): Promise<CallToolResult> {
  const request = {
    node,
    format: "PNG" as const,
    scale,
    effects,
    ...(modes === undefined ? {} : { modes }),
  };
  const where = {
    file,
    target,
  };

  if (clip !== undefined) {
    return clippedShot(
      bridge,
      {
        node,
        scale,
        effects,
        clip,
        ...(save === undefined ? {} : { save }),
        ...(file === undefined ? {} : { file }),
        ...(modes === undefined ? {} : { modes }),
      },
      target,
    );
  }

  if (save !== undefined) {
    const path = await pngPath(save);
    const { bytes } = await exportBytes(bridge, request, where);

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

  // The plugin lowers the scale to fit 2000 px; a render too heavy for an inline image is made again smaller.
  let asked = scale;
  let heavy: number | null = null;

  for (let attempt = 1; ; attempt++) {
    try {
      const { bytes, scale: used } = await exportBytes(
        bridge,
        {
          ...request,
          scale: asked,
          maxSide: MAX_IMAGE_SIDE_PX,
        },
        {
          ...where,
          onFirstChunk: (first, rendered, totalBytes) => {
            assertFitsInline(sizeOf(first, node), node, rendered);

            if (totalBytes > MAX_INLINE_IMAGE_BYTES) {
              throw new TooHeavy(totalBytes, rendered);
            }
          },
        },
      );

      return inlineShot(bytes, node, scale, used, heavy);
    } catch (error) {
      if (!(error instanceof TooHeavy) || attempt >= INLINE_ATTEMPTS) {
        throw error instanceof TooHeavy
          ? new BridgeError(
              "RESULT_TOO_LARGE",
              `${node} renders to ${megabytes(error.totalBytes)} even at scale ${error.scale}, too much to return inline: screenshot one section of it (outline lists them), or pass save with a .png path.`,
            )
          : error;
      }

      heavy = error.totalBytes;
      // The bytes of an image grow with its area, the square of the scale; a tenth less for the estimate's error.
      asked = Math.floor(error.scale * Math.sqrt(MAX_INLINE_IMAGE_BYTES / error.totalBytes) * 0.9 * 100) / 100;
    }
  }
}

type Clip = NonNullable<ScreenshotArgs["clip"]>;
type Modes = NonNullable<ScreenshotArgs["modes"]>;

/**
 * A layer rendered to PNG at the scale, full size; with a clip, a region of it: the whole layer rendered, then cut to
 * the clip, which is measured from the layer's box (inspect says where that box sits in the render: with effects, the
 * render covers what paints around it, and may cover less than the box, as a text's glyphs do). The clip may reach
 * anywhere in the box and what paints around it; the parts of that the render does not cover are transparent.
 */
export async function renderPng(
  bridge: ToolContext["bridge"],
  {
    node,
    scale,
    effects,
    clip,
    modes,
  }: { node: string; scale: number; effects: boolean; clip?: Clip | undefined; modes?: Modes | undefined },
  session: { session: string },
): Promise<{ png: Buffer; scale: number }> {
  const request = {
    node,
    format: "PNG" as const,
    scale,
    effects,
    ...(modes === undefined ? {} : { modes }),
  };

  if (clip === undefined) {
    const { bytes, scale: used } = await exportBytes(bridge, request, { target: session });

    return {
      png: bytes,
      scale: used,
    };
  }

  const inspected = OPERATION_SCHEMAS.inspect.output.parse(await bridge.request("inspect", { nodes: [node] }, session));
  const layer = inspected.layers[0];

  if (layer === undefined) {
    throw new BridgeError("NODE_NOT_FOUND", `${node} is not a layer of this file.`);
  }

  const rendered = effects ? (layer.paintedBox ?? layer.box) : layer.box;
  // Where the clip may reach, from the box's top left: the box and what paints around it.
  const reach = {
    left: Math.min(0, rendered.x - layer.box.x),
    top: Math.min(0, rendered.y - layer.box.y),
    right: Math.max(layer.box.width, rendered.x - layer.box.x + rendered.width),
    bottom: Math.max(layer.box.height, rendered.y - layer.box.y + rendered.height),
  };
  const within =
    clip.x >= reach.left - EDGE_PX &&
    clip.y >= reach.top - EDGE_PX &&
    clip.x + clip.width <= reach.right + EDGE_PX &&
    clip.y + clip.height <= reach.bottom + EDGE_PX;

  if (!within) {
    const painted =
      rendered === layer.box
        ? ""
        : `, and with effects it paints from ${round(reach.left)}, ${round(reach.top)} to ${round(reach.right)}, ${round(reach.bottom)}`;

    throw new BridgeError(
      "OP_FAILED",
      `The clip does not lie within ${node}: its box is ${layer.box.width}×${layer.box.height} px${painted}.`,
    );
  }

  const [renderWidth, renderHeight] = [Math.round(rendered.width * scale), Math.round(rendered.height * scale)];

  if (renderWidth * renderHeight > MAX_CLIP_RENDER_PX) {
    throw new BridgeError(
      "RESULT_TOO_LARGE",
      `A clip renders the whole layer first: ${renderWidth}×${renderHeight} px at scale ${scale} is too much for ${node}. Clip a layer inside it (outline or inspect gives their boxes), or lower the scale.`,
    );
  }

  const { bytes, scale: used } = await exportBytes(bridge, request, { target: session });
  const cropped = cropPng(bytes, {
    x: Math.round((layer.box.x - rendered.x + clip.x) * used),
    y: Math.round((layer.box.y - rendered.y + clip.y) * used),
    width: Math.round(clip.width * used),
    height: Math.round(clip.height * used),
  });

  if (cropped === null) {
    throw new BridgeError("OP_FAILED", `The clip is under a pixel at scale ${used}: give a bigger region or scale.`);
  }

  return {
    png: Buffer.from(cropped),
    scale: used,
  };
}

/** A region of a layer (renderPng with a clip), saved or returned inline. */
async function clippedShot(
  bridge: ToolContext["bridge"],
  { node, scale, effects, save, file, clip, modes }: ScreenshotArgs & { clip: Clip },
  target?: { session: string },
): Promise<CallToolResult> {
  const session = target ?? resolveTarget(bridge.plugins(), file);
  const { png, scale: used } = await renderPng(
    bridge,
    {
      node,
      scale,
      effects,
      clip,
      modes,
    },
    session,
  );
  const size = sizeOf(png, node);

  if (save !== undefined) {
    const path = await pngPath(save);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, png);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            node,
            clip,
            path,
            ...size,
            bytes: png.length,
          }),
        },
      ],
    };
  }

  assertFitsInline(size, node, used);

  if (png.length > MAX_INLINE_IMAGE_BYTES) {
    throw new BridgeError(
      "RESULT_TOO_LARGE",
      `The clip of ${node} is ${megabytes(png.length)}, too much to return inline: a smaller clip or scale, or pass save.`,
    );
  }

  return {
    content: [
      {
        type: "image",
        data: png.toString("base64"),
        mimeType: "image/png",
      },
      {
        type: "text",
        text: `Screenshot of ${node}, ${clip.width}×${clip.height} px from ${clip.x}, ${clip.y} of its box: ${size.width}×${size.height} px at scale ${used}.`,
      },
    ],
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** A render too heavy to return inline, found on its first chunk. */
class TooHeavy extends Error {
  readonly totalBytes: number;
  readonly scale: number;

  constructor(totalBytes: number, scale: number) {
    super("too heavy");
    this.totalBytes = totalBytes;
    this.scale = scale;
  }
}

function inlineShot(bytes: Buffer, node: string, asked: number, used: number, heavy: number | null): CallToolResult {
  const { width, height } = sizeOf(bytes, node);
  const why =
    heavy === null
      ? `fit ${MAX_IMAGE_SIDE_PX} px`
      : `stay under ${megabytes(MAX_INLINE_IMAGE_BYTES)} inline (it was ${megabytes(heavy)})`;
  const full =
    used < asked
      ? ` Scaled down to ${why}: at scale ${asked} it is ${Math.round((width / used) * asked)}×${Math.round((height / used) * asked)} px; screenshot a section, or pass save, for the details.`
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

const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

/**
 * Where save writes: a .png path, never over a file that is not a PNG (a tool that only reads Figma must not destroy
 * a file the user keeps); an earlier screenshot is replaced.
 */
export async function pngPath(save: string): Promise<string> {
  const path = resolve(save);

  if (extname(path).toLowerCase() !== ".png") {
    throw new BridgeError("OP_FAILED", `save must be a .png path, not ${save}.`);
  }

  const existing = await readFile(path).catch(() => null);

  if (existing !== null && imageInfo(existing)?.format !== "png") {
    throw new BridgeError("OP_FAILED", `${path} exists and is not a PNG: choose another path, it is not overwritten.`);
  }

  return path;
}

function sizeOf(bytes: Uint8Array, node: string): { width: number; height: number } {
  const info = imageInfo(bytes);
  const size = info?.format === "png" ? info : null;

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
