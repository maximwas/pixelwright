import { InjectionToken, injectable } from "@needle-di/core";
import { LAYER_SHAPE_KEY } from "@/core/design/hints/structure/structure.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A layer's structure, its names, texts and looks left out: what two layers built alike have in common. */
@injectable()
export class LayerShape {
  key(layer: ReadLayer): string {
    const children = (layer.children ?? []).filter((child) => child.visible).map((child) => this.key(child));

    return LAYER_SHAPE_KEY.of(layer.type, layer.layoutMode ?? "", children);
  }
}

export const LAYER_SHAPE = new InjectionToken<LayerShape>("LayerShape");
