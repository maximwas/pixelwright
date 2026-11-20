import { inject, injectable } from "@needle-di/core";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's min and max width and height in auto layout, pixels or a number variable bound; null takes the limit away. */
@injectable()
export class LimitsStep implements WriteStep {
  readonly keys = STEP_KEYS.limits;
  readonly capability = CAPABILITY.size;
  readonly #values;

  constructor(values = inject(STEP_VALUES)) {
    this.#values = values;
  }

  async check(props: FigmaProps, layer: TypedLayer): Promise<void> {
    await this.#values.check(
      { minWidth: props.minWidth, maxWidth: props.maxWidth, minHeight: props.minHeight, maxHeight: props.maxHeight },
      { layer, modes: props.modes },
    );
  }

  async write(node: SceneNode, props: FigmaProps): Promise<void> {
    await this.#values.write(
      node,
      { minWidth: props.minWidth, maxWidth: props.maxWidth, minHeight: props.minHeight, maxHeight: props.maxHeight },
      props.modes,
    );
  }
}
