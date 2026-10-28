import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import type { PluginServices } from "../../services/plugin-services.ts";

/** One chunk of an image as it was placed, by its hash: not cropped, filtered or scaled. */
export async function originalImage(
  { hash, offset, length, stream }: OperationInput<"image">,
  { images }: PluginServices,
): Promise<OperationOutput<"image">> {
  const { totalBytes, chunk } = await images.read(
    stream ?? hash,
    hash,
    {
      offset,
      length,
    },
    async () => {
      const image = figma.getImageByHash(hash);

      if (image === null) {
        throw new BridgeError("OP_FAILED", `No image with hash ${hash} in this file.`);
      }

      return { bytes: await image.getBytesAsync() };
    },
  );

  return {
    totalBytes,
    bytes: chunk,
  };
}
