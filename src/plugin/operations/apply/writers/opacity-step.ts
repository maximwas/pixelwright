import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's opacity. */
@injectable()
export class OpacityStep implements WriteStep {
  readonly keys = STEP_KEYS.opacity;
  readonly capability = CAPABILITY.opacity;
  readonly #assign;

  constructor(assign = inject(ASSIGN)) {
    this.#assign = assign;
  }

  write(node: SceneNode, { opacity }: FigmaProps): void {
    this.#assign.set(node as FrameNode, { opacity });
  }
}
