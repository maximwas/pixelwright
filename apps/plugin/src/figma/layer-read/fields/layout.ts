import { plain } from "../../../utils/plain.ts";
import { AUTO_LAYOUT_FIELDS, GRID_CHILD_FIELDS, GRID_FIELDS, SIZE_LIMIT_FIELDS } from "../constants.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** Auto layout and grid, the layer's place in its parent's, and how it sizes. */
export function readLayout(entry: LayerEntry): void {
  const { node, layer } = entry;

  if (typeof layer.layoutMode === "string" && layer.layoutMode !== "NONE") {
    entry.putAll(AUTO_LAYOUT_FIELDS);

    if (layer.layoutMode === "GRID") {
      for (const key of GRID_FIELDS) {
        entry.put(key, key.endsWith("Sizes") ? plain(layer[key]) : layer[key]);
      }
    }
  }

  if (node.parent !== null && "layoutMode" in node.parent && node.parent.layoutMode === "GRID") {
    entry.putAll(GRID_CHILD_FIELDS);
  }

  entry.put("layoutSizingHorizontal", layer.layoutSizingHorizontal);
  entry.put("layoutSizingVertical", layer.layoutSizingVertical);
  entry.put("layoutPositioning", layer.layoutPositioning, "AUTO");
  entry.put("layoutGrow", layer.layoutGrow, 0);
  entry.put("layoutAlign", layer.layoutAlign, "INHERIT");
  entry.putAll(SIZE_LIMIT_FIELDS);
}
