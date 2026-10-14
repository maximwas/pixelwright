import { plain } from "../../../utils/plain.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** What the designer set up around the layer: exports, a component's description, the layout Figma infers, and more. */
export function readFacts(entry: LayerEntry): void {
  const { node, layer } = entry;

  if (Array.isArray(layer.exportSettings) && layer.exportSettings.length > 0) {
    entry.set("exportSettings", plain(layer.exportSettings));
  }

  if ((node.type === "COMPONENT" || node.type === "COMPONENT_SET") && node.description !== "") {
    entry.set("description", node.description);
  }

  if (
    layer.layoutMode === "NONE" &&
    typeof layer.inferredAutoLayout === "object" &&
    layer.inferredAutoLayout !== null
  ) {
    readInferredLayout(entry, layer.inferredAutoLayout as InferredAutoLayoutResult);
  }

  entry.put("detached", layer.detachedInfo === null || layer.detachedInfo === undefined ? undefined : true);
  entry.put("missingFont", node.type === "TEXT" && node.hasMissingFont ? true : undefined);
}

/** The auto layout Figma sees in a frame without one. */
function readInferredLayout(entry: LayerEntry, inferred: InferredAutoLayoutResult): void {
  if (inferred.layoutMode !== "NONE") {
    entry.set("inferredLayout", {
      layoutMode: inferred.layoutMode,
      itemSpacing: inferred.itemSpacing,
      primaryAxisAlignItems: inferred.primaryAxisAlignItems,
      counterAxisAlignItems: inferred.counterAxisAlignItems,
      paddingTop: inferred.paddingTop,
      paddingRight: inferred.paddingRight,
      paddingBottom: inferred.paddingBottom,
      paddingLeft: inferred.paddingLeft,
    });
  }
}
