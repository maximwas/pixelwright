import { UPLOAD_MAX_BYTES } from "@pixelwright/core";

/** The most raw bytes one upload chunk carries: base64 makes them a third bigger, still under the bridge's 4 MiB. */
export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;

/** The largest file design_apply reads for an Image or a background: what one upload stream carries. */
export const MAX_SOURCE_BYTES = UPLOAD_MAX_BYTES;

/** The largest SVG an Icon carries inline on its change. */
export const MAX_SVG_BYTES = 2 * 1024 * 1024;

/** The longest side of an image figma.createImage takes (verified live: 4100 px is refused). */
export const MAX_FIGMA_IMAGE_SIDE = 4_096;
