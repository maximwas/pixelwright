import { BridgeError, type OperationOutput } from "@pixelwright/core";
import { EDGE_PX, MAX_CLIP_RENDER_PX } from "../constants/mcp.ts";
import { type ExportRequest, exportBytes } from "../plugin/export-bytes.ts";
import type { PluginSession } from "../plugin/plugin-session.ts";
import { cropPng } from "../utils/crop-png.ts";

/** A region of a layer, from its box's top left, in px. */
export interface Clip {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What to render: a layer at a scale, with or without its effects, in variable modes, cut to a clip. */
export interface RenderSpec {
  readonly node: string;
  readonly scale: number;
  readonly effects: boolean;
  readonly clip?: Clip | undefined;
  readonly modes?: Readonly<Record<string, string>> | undefined;
}

type InspectedLayer = OperationOutput<"inspect">["layers"][number];
type Box = InspectedLayer["box"];

/** A layer's export request as a PNG, in its modes. */
export function pngRequest({ node, scale, effects, modes }: RenderSpec): ExportRequest {
  return {
    node,
    format: "PNG",
    scale,
    effects,
    ...(modes === undefined ? {} : { modes }),
  };
}

/**
 * A layer rendered to PNG at the scale, full size; with a clip, a region of it: the whole layer rendered, then cut to
 * the clip, which is measured from the layer's box (inspect says where that box sits in the render: with effects, the
 * render covers what paints around it, and may cover less than the box, as a text's glyphs do). The clip may reach
 * anywhere in the box and what paints around it; the parts of that the render does not cover are transparent.
 */
export async function renderPng(session: PluginSession, spec: RenderSpec): Promise<{ png: Buffer; scale: number }> {
  if (spec.clip === undefined) {
    const { bytes, scale } = await exportBytes(session, pngRequest(spec));

    return {
      png: bytes,
      scale,
    };
  }

  const layer = (await session.run("inspect", { nodes: [spec.node] })).layers[0];

  if (layer === undefined) {
    throw new BridgeError("NODE_NOT_FOUND", `${spec.node} is not a layer of this file.`);
  }

  const rendered = spec.effects ? (layer.paintedBox ?? layer.box) : layer.box;

  refuseClipOutside(spec.node, layer.box, rendered, spec.clip);

  if (tooHeavy(spec, rendered)) {
    return await coveredClip(session, spec, spec.clip, rendered);
  }

  const { bytes, scale } = await exportBytes(session, pngRequest(spec));

  return {
    png: croppedTo(bytes, layer.box, rendered, {
      clip: spec.clip,
      scale,
    }),
    scale,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The clip lies in the box and what paints around it, give or take float noise. */
function refuseClipOutside(node: string, box: Box, rendered: Box, clip: Clip): void {
  // Where the clip may reach, from the box's top left: the box and what paints around it.
  const reach = {
    left: Math.min(0, rendered.x - box.x),
    top: Math.min(0, rendered.y - box.y),
    right: Math.max(box.width, rendered.x - box.x + rendered.width),
    bottom: Math.max(box.height, rendered.y - box.y + rendered.height),
  };
  const within =
    clip.x >= reach.left - EDGE_PX &&
    clip.y >= reach.top - EDGE_PX &&
    clip.x + clip.width <= reach.right + EDGE_PX &&
    clip.y + clip.height <= reach.bottom + EDGE_PX;

  if (within) {
    return;
  }

  const painted =
    rendered === box
      ? ""
      : `, and with effects it paints from ${round(reach.left)}, ${round(reach.top)} to ${round(reach.right)}, ${round(reach.bottom)}`;

  throw new BridgeError(
    "OP_FAILED",
    `The clip does not lie within ${node}: its box is ${box.width}×${box.height} px${painted}.`,
  );
}

/** Whether rendering the whole layer for a clip is too much. */
function tooHeavy({ scale }: RenderSpec, rendered: Box): boolean {
  return Math.round(rendered.width * scale) * Math.round(rendered.height * scale) > MAX_CLIP_RENDER_PX;
}

/**
 * A clip of a layer too big to render whole: the smallest layer inside it that shows the region the same (an opaque
 * one with nothing over the region, as the plugin's cover finds), rendered alone on its own box and cut there. When
 * there is none, or the plugin is older than cover, the clip is refused before Figma renders anything.
 */
async function coveredClip(
  session: PluginSession,
  spec: RenderSpec,
  clip: Clip,
  rendered: Box,
): Promise<{ png: Buffer; scale: number }> {
  const cover = await coverOf(session, spec.node, clip);

  if (cover === null || cover.node === spec.node) {
    throw heavyError(spec, rendered);
  }

  const own = {
    x: 0,
    y: 0,
    width: cover.width,
    height: cover.height,
  };

  if (tooHeavy(spec, own)) {
    throw heavyError(spec, rendered);
  }

  const { bytes, scale } = await exportBytes(
    session,
    pngRequest({
      ...spec,
      node: cover.node,
      effects: false,
    }),
  );
  const region = {
    x: clip.x - cover.x,
    y: clip.y - cover.y,
    width: clip.width,
    height: clip.height,
  };

  return {
    png: croppedTo(bytes, own, own, {
      clip: region,
      scale,
    }),
    scale,
  };
}

/** The plugin's cover of the region, or null from a plugin that does not know the operation. */
async function coverOf(session: PluginSession, node: string, clip: Clip): Promise<OperationOutput<"cover"> | null> {
  try {
    return await session.run("cover", {
      node,
      clip,
    });
  } catch (error) {
    if (error instanceof BridgeError && error.code === "UNKNOWN_OP") {
      return null;
    }

    throw error;
  }
}

function heavyError({ node, scale }: RenderSpec, rendered: Box): BridgeError {
  const [width, height] = [Math.round(rendered.width * scale), Math.round(rendered.height * scale)];

  return new BridgeError(
    "RESULT_TOO_LARGE",
    `A clip renders the whole layer first: ${width}×${height} px at scale ${scale} is too much for ${node}, and no opaque layer inside it holds the region alone. Clip a layer inside it (outline or inspect gives their boxes), or lower the scale.`,
  );
}

function croppedTo(bytes: Buffer, box: Box, rendered: Box, { clip, scale }: { clip: Clip; scale: number }): Buffer {
  const cropped = cropPng(bytes, {
    x: Math.round((box.x - rendered.x + clip.x) * scale),
    y: Math.round((box.y - rendered.y + clip.y) * scale),
    width: Math.round(clip.width * scale),
    height: Math.round(clip.height * scale),
  });

  if (cropped === null) {
    throw new BridgeError("OP_FAILED", `The clip is under a pixel at scale ${scale}: give a bigger region or scale.`);
  }

  return Buffer.from(cropped);
}
