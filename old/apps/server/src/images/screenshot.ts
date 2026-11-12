import type { CallToolResult } from "@modelcontextprotocol/server";
import { BridgeError } from "@pixelwright/core";
import { INLINE_ATTEMPTS, MAX_IMAGE_SIDE_PX, MAX_INLINE_IMAGE_BYTES } from "../constants/mcp.ts";
import { exportBytes } from "../plugin/export-bytes.ts";
import type { PluginSession } from "../plugin/plugin-session.ts";
import { assertFitsInline, megabytes, pngPath, pngSize, writePng } from "./png-files.ts";
import { type Clip, pngRequest, type RenderSpec, renderPng } from "./render-png.ts";

/** A screenshot to take: a layer rendered, written to a file when save names one, cut to a clip when one is given. */
export interface ShotSpec extends RenderSpec {
  readonly save?: string | undefined;
}

/** A layer's screenshot from the session's file: inline, scaled down to fit when it must, or saved full size. */
export async function takeScreenshot(session: PluginSession, spec: ShotSpec): Promise<CallToolResult> {
  if (spec.clip !== undefined) {
    return await clippedShot(session, spec, spec.clip);
  }

  if (spec.save !== undefined) {
    return await savedShot(session, spec, spec.save);
  }

  return await inlineShot(session, spec);
}

async function savedShot(session: PluginSession, spec: ShotSpec, save: string): Promise<CallToolResult> {
  const path = await pngPath(save);
  const { bytes } = await exportBytes(session, pngRequest(spec));

  await writePng(path, bytes);

  return textResult({
    node: spec.node,
    path,
    ...pngSize(bytes, spec.node),
    bytes: bytes.length,
  });
}

/** The plugin lowers the scale to fit 2000 px; a render too heavy for an inline image is made again smaller. */
async function inlineShot(session: PluginSession, spec: ShotSpec): Promise<CallToolResult> {
  let asked = spec.scale;
  let heavy: number | null = null;

  for (let attempt = 1; ; attempt++) {
    try {
      const { bytes, scale } = await exportBytes(
        session,
        {
          ...pngRequest(spec),
          scale: asked,
          maxSide: MAX_IMAGE_SIDE_PX,
        },
        (first, rendered, totalBytes) =>
          refuseHeavy(first, spec.node, {
            rendered,
            totalBytes,
          }),
      );

      return inlineResult(bytes, {
        node: spec.node,
        asked: spec.scale,
        used: scale,
        heavy,
      });
    } catch (error) {
      if (!(error instanceof TooHeavy) || attempt >= INLINE_ATTEMPTS) {
        throw error instanceof TooHeavy ? tooHeavyError(spec.node, error) : error;
      }

      heavy = error.totalBytes;
      // The bytes of an image grow with its area, the square of the scale; a tenth less for the estimate's error.
      asked = Math.floor(error.scale * Math.sqrt(MAX_INLINE_IMAGE_BYTES / error.totalBytes) * 0.9 * 100) / 100;
    }
  }
}

function refuseHeavy(
  first: Buffer,
  node: string,
  { rendered, totalBytes }: { rendered: number; totalBytes: number },
): void {
  assertFitsInline(pngSize(first, node), node, rendered);

  if (totalBytes > MAX_INLINE_IMAGE_BYTES) {
    throw new TooHeavy(totalBytes, rendered);
  }
}

function tooHeavyError(node: string, { totalBytes, scale }: TooHeavy): BridgeError {
  return new BridgeError(
    "RESULT_TOO_LARGE",
    `${node} renders to ${megabytes(totalBytes)} even at scale ${scale}, too much to return inline: screenshot one section of it (outline lists them), or pass save with a .png path.`,
  );
}

/** A region of a layer (renderPng with a clip), saved or returned inline. */
async function clippedShot(session: PluginSession, spec: ShotSpec, clip: Clip): Promise<CallToolResult> {
  const { png, scale } = await renderPng(session, spec);
  const size = pngSize(png, spec.node);

  if (spec.save !== undefined) {
    const path = await pngPath(spec.save);

    await writePng(path, png);

    return textResult({
      node: spec.node,
      clip,
      path,
      ...size,
      bytes: png.length,
    });
  }

  assertFitsInline(size, spec.node, scale);

  if (png.length > MAX_INLINE_IMAGE_BYTES) {
    throw new BridgeError(
      "RESULT_TOO_LARGE",
      `The clip of ${spec.node} is ${megabytes(png.length)}, too much to return inline: a smaller clip or scale, or pass save.`,
    );
  }

  return imageResult(
    png,
    `Screenshot of ${spec.node}, ${clip.width}×${clip.height} px from ${clip.x}, ${clip.y} of its box: ${size.width}×${size.height} px at scale ${scale}.`,
  );
}

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

function inlineResult(
  bytes: Buffer,
  { node, asked, used, heavy }: { node: string; asked: number; used: number; heavy: number | null },
): CallToolResult {
  const { width, height } = pngSize(bytes, node);
  const why =
    heavy === null
      ? `fit ${MAX_IMAGE_SIDE_PX} px`
      : `stay under ${megabytes(MAX_INLINE_IMAGE_BYTES)} inline (it was ${megabytes(heavy)})`;
  const full =
    used < asked
      ? ` Scaled down to ${why}: at scale ${asked} it is ${Math.round((width / used) * asked)}×${Math.round((height / used) * asked)} px; screenshot a section, or pass save, for the details.`
      : "";

  return imageResult(bytes, `Screenshot of ${node}: ${width}×${height} px at scale ${used}.${full}`);
}

function imageResult(png: Buffer, text: string): CallToolResult {
  return {
    content: [
      {
        type: "image",
        data: png.toString("base64"),
        mimeType: "image/png",
      },
      {
        type: "text",
        text,
      },
    ],
  };
}

function textResult(value: object): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value),
      },
    ],
  };
}
