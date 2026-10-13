import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BridgeError } from "@pixelwright/core";
import { decode, encode } from "fast-png";
import type * as z from "zod";
import { resolveTarget } from "../bridge/target.ts";
import { REFERENCE_MAX_BYTES } from "../constants/images.ts";
import type { ImageCompareInputSchema, ImageCompareOutputSchema } from "../schemas/tools.ts";
import type { RgbaImage } from "../types/images.ts";
import type { ToolContext } from "../types/mcp.ts";
import { compareImages, differenceImage } from "../utils/image-compare.ts";
import { toRgba } from "../utils/rgba.ts";
import { pngPath, renderPng } from "./screenshot.ts";

type ImageCompareArgs = z.output<typeof ImageCompareInputSchema>;
type ImageCompare = z.output<typeof ImageCompareOutputSchema>;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The layer rendered, the reference read, both compared; the difference written when asked. */
export async function compareImage(
  bridge: ToolContext["bridge"],
  { node, reference, scale, effects, clip, diff, file }: ImageCompareArgs,
): Promise<ImageCompare> {
  const wanted = await referenceImage(reference);
  const { png, scale: used } = await renderPng(
    bridge,
    {
      node,
      scale,
      effects,
      clip,
    },
    resolveTarget(bridge.plugins(), file),
  );
  const rendered = toRgba(decode(png));
  const result = compareImages(rendered, wanted);
  const size = {
    node: `${rendered.width}×${rendered.height}`,
    reference: `${wanted.width}×${wanted.height}`,
  };
  let written: string | undefined;

  if (diff !== undefined) {
    written = await pngPath(diff);

    const image = differenceImage(rendered, wanted);

    await mkdir(dirname(written), { recursive: true });
    await writeFile(
      written,
      encode({
        width: image.width,
        height: image.height,
        channels: 4,
        data: image.data,
      }),
    );
  }

  return {
    size,
    scale: used,
    ...result,
    ...(written === undefined ? {} : { diff: written }),
    ...(size.node === size.reference
      ? {}
      : {
          note: `The sizes differ (render ${size.node}, reference ${size.reference}): only the part both cover from the top left is compared, and edges past it count as missing or extra. Take the reference at scale ${used} and the layer's size, or clip the render.`,
        }),
  };
}

/** The reference PNG as RGBA, from a path relative to the server's folder or absolute. */
async function referenceImage(reference: string): Promise<RgbaImage> {
  const path = resolve(reference);
  const size = await stat(path).then(
    (info) => info.size,
    () => {
      throw new BridgeError("OP_FAILED", `There is no file at ${path}.`);
    },
  );

  if (size > REFERENCE_MAX_BYTES) {
    throw new BridgeError("OP_FAILED", `${path} is over ${REFERENCE_MAX_BYTES / 1024 / 1024} MB.`);
  }

  const bytes = await readFile(path);

  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new BridgeError("OP_FAILED", `${path} is not a PNG: save the screenshot to compare as PNG.`);
  }

  return toRgba(decode(bytes));
}
