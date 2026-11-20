import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { BLEND, STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's blend mode; CSS's normal on a layer whose children blend as one is Figma's pass through. */
@injectable()
export class BlendStep implements WriteStep {
  readonly keys = STEP_KEYS.blend;
  readonly capability = CAPABILITY.effects;
  readonly #assign;
  readonly #passing: ReadonlySet<string> = new Set(BLEND.passing);

  constructor(assign = inject(ASSIGN)) {
    this.#assign = assign;
  }

  write(node: SceneNode, { blendMode }: FigmaProps): void {
    const mode = blendMode === BLEND.normal && this.#passing.has(node.type) ? BLEND.passThrough : blendMode;

    this.#assign.set(node as FrameNode, { blendMode: mode as BlendMode | undefined });
  }
}
