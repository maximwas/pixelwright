import { LIMITS } from "@/shared/limits/limits.constants.ts";

const MIB = 1024 * 1024;

/** The numbers of a render, each with its reason. */
export const RENDERS = {
  /** A clip renders the whole layer first: past this many pixels (8000 x 8000, 256 MB as RGBA) a cover layer instead (O-014). */
  clipRenderPx: 64_000_000,
  /** Float noise in Figma's boxes: a clip this far past the edge still lies within. */
  edgePx: 0.01,
  /** A re-render asks a tenth less than the estimate: bytes grow with the area, the square of the scale, not exactly. */
  retryMargin: 0.9,
  /** Scales a render names are floored to 2 decimals. */
  scaleSteps: 100,
  /** A clip's edges in a message keep 2 decimals. */
  edgeSteps: 100,
  /** How a chunk and an image block carry bytes. */
  encoding: "base64",
} as const;

export const BYTES_TEXT = { megabytes: (bytes: number) => `${Math.round((bytes / MIB) * 10) / 10} MB` } as const;

/** An image's size and scale, as the texts name them. */
interface ImageSize {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/** A clip, as the texts name it. */
interface ClipText {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 0.7.0's words for renders, their errors and their lines (T-071, T-073, T-075). */
export const RENDERS_TEXT = {
  changed: (node: string) => `${node} changed while it was being exported: try again.`,
  empty: (node: string) => `The plugin sent an empty part of ${node}'s export: try again.`,
  notPng: (node: string) => `Figma's export of ${node} is not a PNG.`,
  outside: (
    node: string,
    box: ClipText,
    paints: string,
  ) =>
    `The clip does not lie within ${node}: its box is ${box.width}×${box.height} px${paints}.`,
  paints: (reach: { left: number; top: number; right: number; bottom: number }) =>
    `, and with effects it paints from ${reach.left}, ${reach.top} to ${reach.right}, ${reach.bottom}`,
  underPixel: (scale: number) => `The clip is under a pixel at scale ${scale}: give a bigger region or scale.`,
  heavyClip: (
    node: string,
    width: number,
    height: number,
    scale: number,
  ) =>
    `A clip renders the whole layer first: ${width}×${height} px at scale ${scale} is too much for ${node}, and no opaque layer inside it holds the region alone. Clip a layer inside it (outline gives their boxes), or lower the scale.`,
  tooHeavy: (
    node: string,
    size: string,
    scale: number,
  ) =>
    `${node} renders to ${size} even at scale ${scale}, too much to return inline: screenshot one section of it (outline lists them), or pass save with a .png path.`,
  tooWide: (
    node: string,
    image: ImageSize,
    fit: number,
  ) =>
    `${node} renders at ${image.width}×${image.height} px at scale ${image.scale}, over the ${LIMITS.inlineImageSidePx} px returned inline: use scale ${fit}, screenshot one section of it (outline lists them), or pass save with a file path to get it full size.`,
  heavyCut: (node: string, size: string) =>
    `The clip of ${node} is ${size}, too much to return inline: a smaller clip or scale, or pass save.`,
  shot: (
    node: string,
    image: ImageSize,
    more: string,
  ) =>
    `Screenshot of ${node}: ${image.width}×${image.height} px at scale ${image.scale}.${more}`,
  scaledDown: (
    why: string,
    asked: number,
    width: number,
    height: number,
  ) =>
    ` Scaled down to ${why}: at scale ${asked} it is ${width}×${height} px; screenshot a section, or pass save, for the details.`,
  fitSide: `fit ${LIMITS.inlineImageSidePx} px`,
  fitBytes: (limit: string, was: string) => `stay under ${limit} inline (it was ${was})`,
  clipShot: (
    node: string,
    clip: ClipText,
    image: ImageSize,
  ) =>
    `Screenshot of ${node}, ${clip.width}×${clip.height} px from ${clip.x}, ${clip.y} of its box: ${image.width}×${image.height} px at scale ${image.scale}.`,
} as const;
