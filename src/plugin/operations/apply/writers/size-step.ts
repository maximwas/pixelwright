import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_HUG } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * A layer's width and height in pixels, or hugging (auto); a section has no resize, only resizeWithoutConstraints,
 * and a line has no height.
 */
@injectable()
export class SizeStep implements WriteStep {
  readonly keys = STEP_KEYS.size;
  readonly capability = CAPABILITY.size;
  readonly #assign;
  readonly #values;

  constructor(assign = inject(ASSIGN), values = inject(STEP_VALUES)) {
    this.#assign = assign;
    this.#values = values;
  }

  write(node: SceneNode, { width, height }: FigmaProps): void {
    const box = node as FrameNode;
    const wide = (width === INTENT_HUG ? undefined : this.#values.number(width)) ?? box.width;
    const high = (height === INTENT_HUG ? undefined : this.#values.number(height)) ?? box.height;

    // shortcut: resize fixes both axes; the layout and geometry item restores hug and fill around it.
    if (wide !== box.width || high !== box.height) {
      if (node.type === FIGMA_NODE_TYPE.section) {
        node.resizeWithoutConstraints(wide, high);
      } else {
        box.resize(wide, node.type === FIGMA_NODE_TYPE.line ? 0 : high);
      }
    }

    this.#assign.set(box, {
      layoutSizingHorizontal: width === INTENT_HUG ? INTENT_HUG : undefined,
      layoutSizingVertical: height === INTENT_HUG ? INTENT_HUG : undefined,
    });
  }
}
