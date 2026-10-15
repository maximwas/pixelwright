import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { BridgeError } from "@pixelwright/core";
import { imageInfo } from "../assets/image-info.ts";
import { MAX_IMAGE_SIDE_PX } from "../constants/mcp.ts";

/** A PNG's size in pixels. */
export interface PngSize {
  readonly width: number;
  readonly height: number;
}

export const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

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

/** Writes a PNG to a path pngPath gave, its folder made. */
export async function writePng(path: string, png: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, png);
}

export function pngSize(bytes: Uint8Array, node: string): PngSize {
  const info = imageInfo(bytes);
  const size = info?.format === "png" ? info : null;

  if (size === null) {
    throw new BridgeError("OP_FAILED", `Figma's export of ${node} is not a PNG.`);
  }

  return size;
}

/** Refuses a render too big to return inline, naming the scale that would fit. */
export function assertFitsInline({ width, height }: PngSize, node: string, scale: number): void {
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
