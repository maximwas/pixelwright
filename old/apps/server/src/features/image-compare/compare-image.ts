import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BridgeError } from "@pixelwright/core";
import { decode, encode } from "fast-png";
import type * as z from "zod";
import { REFERENCE_MAX_BYTES } from "../../constants/images.ts";
import { pngPath } from "../../images/png-files.ts";
import { type RenderSpec, renderPng } from "../../images/render-png.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import type { RgbaImage } from "../../types/images.ts";
import { compareImages, differenceImage } from "../../utils/image-compare.ts";
import { toRgba } from "../../utils/rgba.ts";
import type { ImageCompareInputSchema, ImageCompareOutputSchema } from "./schemas.ts";

type ImageCompareArgs = z.output<typeof ImageCompareInputSchema>;
type ImageCompare = z.output<typeof ImageCompareOutputSchema>;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The layer rendered, the reference read (a PNG, or another layer rendered the same way), both compared; the
 * difference written when asked.
 */
export async function compareImage(
  plugin: PluginClient,
  { node, reference, against, scale, effects, clip, modes, diff, file }: ImageCompareArgs,
): Promise<ImageCompare> {
  const session = plugin.session(file);
  const spec = {
    scale,
    effects,
    clip,
    modes,
  };
  const wanted = await wantedImage(session, {
    reference,
    against,
    spec,
  });
  const { png, scale: used } = await renderPng(session, {
    node,
    ...spec,
  });
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
    ...(size.node === size.reference ? {} : { note: sizesNote(size, used, against) }),
  };
}

/** What a comparison of two sizes covers, and how to make them one. */
function sizesNote(size: { node: string; reference: string }, scale: number, against: string | undefined): string {
  const covered =
    "only the part both cover from the top left is compared, and edges past it count as missing or extra.";

  return against === undefined
    ? `The sizes differ (render ${size.node}, reference ${size.reference}): ${covered} Take the reference at scale ${scale} and the layer's size, or clip the render.`
    : `The sizes differ (render ${size.node}, ${against} ${size.reference}): ${covered} Clip both to one region to compare it alone.`;
}

/** What the layer is compared with: the reference PNG, or the other layer rendered as the layer is. */
async function wantedImage(
  session: PluginSession,
  {
    reference,
    against,
    spec,
  }: { reference?: string | undefined; against?: string | undefined; spec: Omit<RenderSpec, "node"> },
): Promise<RgbaImage> {
  if (reference !== undefined && against !== undefined) {
    throw new BridgeError("OP_FAILED", "Give reference or against, one of them: a PNG or another layer.");
  }

  if (against !== undefined) {
    return toRgba(
      decode(
        (
          await renderPng(session, {
            ...spec,
            node: against,
          })
        ).png,
      ),
    );
  }

  if (reference === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      "Give reference, a PNG of your build, or against, another layer's id, to compare the layer with.",
    );
  }

  return await referenceImage(reference);
}

/** The reference PNG as RGBA, from its path (the tool has resolved a relative one from the project folder). */
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
