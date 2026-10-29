import { injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * A layer's effects (0.7.0's effects reader): shadows and blurs as plain data, bound variables on their colours
 * included, and the effect style they come from; only for a layer with effects. The server maps them to CSS.
 */
@injectable()
export class EffectFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    if (!("effects" in node) || node.effects.length === 0) {
      return {};
    }

    return {
      // Plugin API effects are frozen objects: a JSON copy is what goes on the wire anyway.
      effects: JSON.parse(JSON.stringify(node.effects)),
      ...(node.effectStyleId === "" ? {} : { effectStyleId: node.effectStyleId }),
    };
  }
}
