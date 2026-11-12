import { fnv1a, MIXED } from "@pixelwright/core";
import { plain } from "../../../utils/plain.ts";
import { CORNER_FIELDS, STROKE_SIDE_FIELDS } from "../constants.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** Fills, strokes with how they are drawn, layout grids, a vector's drawing (as a hash) and effects. */
export function readPaints(entry: LayerEntry): void {
  const { layer, context } = entry;

  entry.paints("fills", layer.fills);
  entry.paints("strokes", layer.strokes);

  if (Array.isArray(layer.layoutGrids) && layer.layoutGrids.length > 0) {
    entry.set("layoutGrids", plain(layer.layoutGrids));
  }

  if (context.paths && Array.isArray(layer.vectorPaths) && layer.vectorPaths.length > 0) {
    // Not the paths themselves (an icon's can be long): enough to tell two drawings apart.
    entry.set("pathHash", fnv1a(JSON.stringify(layer.vectorPaths)));
  }

  if (Array.isArray(entry.get("strokes"))) {
    readStroke(entry);
  }

  entry.paints("effects", layer.effects);
}

/** The corner radius, per corner where they differ, and the corners' smoothing. */
export function readCorners(entry: LayerEntry): void {
  const { layer } = entry;

  entry.put("cornerRadius", layer.cornerRadius, 0);

  if (entry.get("cornerRadius") === MIXED) {
    entry.putAll(CORNER_FIELDS);
  }

  entry.put("cornerSmoothing", layer.cornerSmoothing, 0);
}

function readStroke(entry: LayerEntry): void {
  const { layer } = entry;

  entry.put("strokeWeight", layer.strokeWeight);

  if (entry.get("strokeWeight") === MIXED) {
    entry.putAll(STROKE_SIDE_FIELDS);
  }

  entry.put("strokeAlign", layer.strokeAlign);
  entry.put("strokeCap", layer.strokeCap, "NONE");

  if (Array.isArray(layer.dashPattern) && layer.dashPattern.length > 0) {
    entry.set("dashPattern", [...layer.dashPattern]);
  }
}
