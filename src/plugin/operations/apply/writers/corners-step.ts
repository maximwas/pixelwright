import { inject, injectable } from "@needle-di/core";
import { CAPABILITIES, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { CORNERS, STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's corner radius: one, or one per corner on the layers that have them, each pixels or a number variable bound. */
@injectable()
export class CornersStep implements WriteStep {
  readonly keys = STEP_KEYS.corners;
  readonly capability = CAPABILITY.corners;
  readonly #values;
  readonly #capabilities;

  constructor(values = inject(STEP_VALUES), capabilities = inject(CAPABILITIES)) {
    this.#values = values;
    this.#capabilities = capabilities;
  }

  async check({ cornerRadius }: FigmaProps, layer: TypedLayer): Promise<void> {
    if (Array.isArray(cornerRadius)) {
      this.#capabilities.require(layer, CAPABILITY.cornerSides);
    }

    await this.#values.check({ cornerRadius });
  }

  async write(node: SceneNode, { cornerRadius }: FigmaProps): Promise<void> {
    await this.#values.write(
      node,
      Array.isArray(cornerRadius)
        ? Object.fromEntries(CORNERS.map((field, index) => [field, cornerRadius[index]]))
        : { cornerRadius },
    );
  }
}
