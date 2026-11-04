import { injectable } from "@needle-di/core";
import { FACT } from "@/plugin/adapters/figma/layer-meta/layer-meta.constants.ts";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/**
 * What the hints read of a layer (C-151): the auto layout Figma guesses for a frame without one, a frame detached from
 * a component, a text whose font this machine lacks; and a locked layer, which design_read says.
 */
@injectable()
export class FactFieldReader implements FieldReader {
  read(node: SceneNode): Partial<ReadLayer> {
    const guess = "inferredAutoLayout" in node && node.layoutMode === FACT.none ? node.inferredAutoLayout : null;
    const detached = "detachedInfo" in node && node.detachedInfo !== null;
    const missingFont = node.type === FACT.text && node.hasMissingFont;

    return {
      ...(guess === null || guess.layoutMode === FACT.none
        ? {}
        : {
          inferredLayout: {
            layoutMode: guess.layoutMode,
            itemSpacing: guess.itemSpacing,
            primaryAxisAlignItems: guess.primaryAxisAlignItems,
            counterAxisAlignItems: guess.counterAxisAlignItems,
            paddingTop: guess.paddingTop,
            paddingRight: guess.paddingRight,
            paddingBottom: guess.paddingBottom,
            paddingLeft: guess.paddingLeft,
          },
        }),
      ...(detached ? { detached: true } : {}),
      ...(missingFont ? { missingFont: true } : {}),
      ...(node.locked ? { locked: true } : {}),
    };
  }
}
