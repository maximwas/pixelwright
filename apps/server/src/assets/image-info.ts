import { disableTypes, imageSize, types } from "image-size";

/** The image formats Pixelwright reads and writes; image-size knows twenty, the rest stay unknown here. */
const FORMATS = ["png", "jpg", "gif", "webp"] as const;

type ImageFormat = (typeof FORMATS)[number];

disableTypes(types.filter((type) => !(FORMATS as readonly string[]).includes(type)));

/** An image's format (PNG, JPEG, GIF or WebP) and size, read from its header; null for any other bytes. */
export function imageInfo(bytes: Uint8Array): { format: ImageFormat; width: number; height: number } | null {
  try {
    const { type, width, height } = imageSize(bytes);

    return (FORMATS as readonly string[]).includes(type ?? "")
      ? {
          format: type as ImageFormat,
          width,
          height,
        }
      : null;
  } catch {
    return null;
  }
}
