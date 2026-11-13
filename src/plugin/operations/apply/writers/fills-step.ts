import { inject, injectable } from "@needle-di/core";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { PAINT_WRITE } from "@/plugin/operations/apply/writers/paint-write.ts";
import { PAINT_FIELD, STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's background as its fills (P-092): a paint style alone, or colours, variables and gradients. */
@injectable()
export class FillsStep implements WriteStep {
  readonly keys = STEP_KEYS.fills;
  readonly capability = CAPABILITY.fills;
  readonly #paints;

  constructor(paints = inject(PAINT_WRITE)) {
    this.#paints = paints;
  }

  async check({ fills }: FigmaProps): Promise<void> {
    await this.#paints.check(fills ?? []);
  }

  async write(node: SceneNode, { fills }: FigmaProps): Promise<void> {
    const layer = node as FrameNode;
    const paints = await this.#paints.paints(fills ?? [], node);

    if (typeof paints !== "string") {
      this.#paints.set(node, PAINT_FIELD.fills, paints, layer.fillStyleId);
    } else if (layer.fillStyleId !== paints) {
      await layer.setFillStyleIdAsync(paints);
    }
  }
}
