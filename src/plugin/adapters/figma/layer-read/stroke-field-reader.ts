import { injectable } from "@needle-di/core";
import { STROKE_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/**
 * A layer's strokes and how they are drawn (0.7.0's stroke reader): the paints, the weight (each side's when they
 * differ), the align, a cap other than none, and the dash pattern; only for a layer with strokes.
 */
@injectable()
export class StrokeFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    if (!("strokes" in node) || node.strokes.length === 0) {
      return {};
    }

    return {
      strokes: JSON.parse(JSON.stringify(node.strokes)),
      ...(node.strokeStyleId === "" ? {} : { strokeStyleId: node.strokeStyleId }),
      ...this.#weight(node),
      strokeAlign: node.strokeAlign,
      ...("strokeCap" in node && node.strokeCap !== figma.mixed && node.strokeCap !== STROKE_FIELD.noCap
        ? { strokeCap: node.strokeCap }
        : {}),
      ...(node.dashPattern.length > 0 ? { dashPattern: [...node.dashPattern] } : {}),
    };
  }

  #weight(node: SceneNode & MinimalStrokesMixin): Partial<ReadLayer> {
    if (node.strokeWeight !== figma.mixed) {
      return { strokeWeight: node.strokeWeight };
    }

    return {
      strokeWeight: READ_VALUE.mixed,
      ...("strokeTopWeight" in node
        ? {
          strokeTopWeight: node.strokeTopWeight,
          strokeRightWeight: node.strokeRightWeight,
          strokeBottomWeight: node.strokeBottomWeight,
          strokeLeftWeight: node.strokeLeftWeight,
        }
        : {}),
    };
  }
}
