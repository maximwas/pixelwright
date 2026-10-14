import type { LayerEntry } from "../layer-entry.ts";

/** How a layer mixes with what is under it: opacity, blend mode, masking, clipping, and its constraints. */
export function readBlending(entry: LayerEntry): void {
  const { layer } = entry;

  entry.put("opacity", layer.opacity, 1);

  if (layer.blendMode !== "PASS_THROUGH" && layer.blendMode !== "NORMAL") {
    entry.put("blendMode", layer.blendMode);
  }

  entry.put("isMask", layer.isMask, false);

  if (entry.get("isMask")) {
    entry.put("maskType", layer.maskType);
  }

  entry.put("clipsContent", layer.clipsContent, false);

  const constraints = layer.constraints as Constraints | undefined;

  if (constraints !== undefined && (constraints.horizontal !== "MIN" || constraints.vertical !== "MIN")) {
    entry.set("constraints", { ...constraints });
  }
}
