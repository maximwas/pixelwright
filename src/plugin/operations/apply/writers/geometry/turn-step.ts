import { inject, injectable } from "@needle-di/core";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import { STEP_GEOMETRY } from "@/plugin/operations/apply/writers/geometry/step-geometry.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** The turn and the mirror about the layer's centre (P-151), before its placement: a turned layer is placed by it. */
@injectable()
export class TurnStep implements WriteStep {
  readonly keys = STEP_KEYS.turn;
  readonly capability = CAPABILITY.size;
  readonly #geometry;

  constructor(geometry = inject(STEP_GEOMETRY)) {
    this.#geometry = geometry;
  }

  write(node: SceneNode, { rotation = 0, mirror = false }: FigmaProps): void {
    this.#geometry.turn(node, rotation, mirror);
  }
}
