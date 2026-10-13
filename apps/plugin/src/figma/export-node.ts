import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { asOwnWrite } from "./changes.ts";
import { chunkSource } from "./chunks.ts";
import { requireEdits } from "./edits.ts";
import { requireNode } from "./nodes.ts";

const exports = chunkSource<{ bytes: Uint8Array; scale: number }>();
const images = chunkSource<{ bytes: Uint8Array }>();

/** One chunk of a layer's export, rendered once per stream (one export the server reads). */
export async function exportNode(input: OperationInput<"export">): Promise<OperationOutput<"export">> {
  const { node: id, format, effects, offset, length, maxSide, modes } = input;
  const key = JSON.stringify([id, format, input.scale, effects, maxSide, modes]);
  const { result, totalBytes, chunk } = await exports(input.stream ?? key, key, offset, length, () =>
    modes === undefined || Object.keys(modes).length === 0
      ? render(id, format, input.scale, effects, maxSide)
      : inModes(id, modes, () => render(id, format, input.scale, effects, maxSide)),
  );

  return {
    scale: result.scale,
    totalBytes,
    bytes: chunk,
  };
}

/** One chunk of an image as it was placed, by its hash: not cropped, filtered or scaled. */
export async function originalImage({
  hash,
  offset,
  length,
  stream,
}: OperationInput<"image">): Promise<OperationOutput<"image">> {
  const { totalBytes, chunk } = await images(stream ?? hash, hash, offset, length, async () => {
    const image = figma.getImageByHash(hash);

    if (image === null) {
      throw new BridgeError("OP_FAILED", `No image with hash ${hash} in this file.`);
    }

    return { bytes: await image.getBytesAsync() };
  });

  return {
    totalBytes,
    bytes: chunk,
  };
}

async function render(
  id: string,
  format: OperationInput<"export">["format"],
  asked: number,
  effects: boolean,
  maxSide: number | undefined,
): Promise<{ bytes: Uint8Array; scale: number }> {
  const node = await requireNode(id);

  if (!("exportAsync" in node)) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${node.type.toLowerCase()}, which cannot be exported.`);
  }

  const vector = format === "SVG" || format === "PDF";
  const scale = vector || maxSide === undefined ? asked : fittedScale(node, asked, effects, maxSide);

  // useAbsoluteBounds: the layer's own box, without the shadows and outside strokes that make it bigger.
  const settings: ExportSettings =
    format === "SVG" || format === "PDF"
      ? {
          format,
          useAbsoluteBounds: !effects,
        }
      : {
          format,
          constraint: {
            type: "SCALE",
            value: scale,
          },
          useAbsoluteBounds: !effects,
        };

  return {
    bytes: await node.exportAsync(settings),
    scale,
  };
}

/** The scale asked for, or lower so the rendered box (with its shadows when effects are on) fits maxSide. */
function fittedScale(node: BaseNode, asked: number, effects: boolean, maxSide: number): number {
  const rendered = effects && "absoluteRenderBounds" in node ? node.absoluteRenderBounds : null;
  const box = rendered ?? ("width" in node ? node : null);

  if (box === null) {
    return asked;
  }

  const side = Math.max(box.width, box.height) * asked;

  // Floored to four decimals: Figma rounds the rendered size, and 2000.4 px must not become 2001.
  return side <= maxSide ? asked : Math.floor((maxSide / side) * asked * 10_000) / 10_000;
}

/**
 * Runs a render with the layer in the variable modes asked for (collection and mode by name, any case), then sets its
 * modes back: a write for a moment, so Allow edits must be on; one undo step that leaves the file as it was.
 */
async function inModes<T>(id: string, modes: Readonly<Record<string, string>>, run: () => Promise<T>): Promise<T> {
  requireEdits();

  const node = await requireNode(id);

  if (!("resolvedVariableModes" in node) || !("setExplicitVariableModeForCollection" in node)) {
    throw new BridgeError("OP_FAILED", `${id} is a ${node.type.toLowerCase()}, which takes no variable modes.`);
  }

  const collections = await Promise.all(
    [
      ...new Set([
        ...Object.keys(node.resolvedVariableModes),
        ...(await figma.variables.getLocalVariableCollectionsAsync()).map((collection) => collection.id),
      ]),
    ].map((collectionId) => figma.variables.getVariableCollectionByIdAsync(collectionId)),
  );
  const chosen = Object.entries(modes).map(([collectionName, modeName]) => {
    const collection = collections.find((each) => each?.name.toLowerCase() === collectionName.toLowerCase());

    if (collection === null || collection === undefined) {
      throw new BridgeError(
        "OP_FAILED",
        `No variable collection named ${collectionName} applies to ${id}: ${collections.flatMap((each) => (each === null ? [] : [each.name])).join(", ") || "none does"}.`,
      );
    }

    const mode = collection.modes.find((each) => each.name.toLowerCase() === modeName.toLowerCase());

    if (mode === undefined) {
      throw new BridgeError(
        "OP_FAILED",
        `${collection.name} has no mode ${modeName}: ${collection.modes.map((each) => each.name).join(", ")}.`,
      );
    }

    return {
      collection,
      mode: mode.modeId,
      before: node.explicitVariableModes[collection.id],
    };
  });

  return asOwnWrite(async () => {
    try {
      for (const { collection, mode } of chosen) {
        node.setExplicitVariableModeForCollection(collection, mode);
      }

      return await run();
    } finally {
      for (const { collection, before } of chosen) {
        if (before === undefined) {
          node.clearExplicitVariableModeForCollection(collection);
        } else {
          node.setExplicitVariableModeForCollection(collection, before);
        }
      }

      figma.commitUndo();
    }
  });
}
