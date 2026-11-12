import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Limit = FigmaProps["minWidth"];

/** A layer's min and max width and height in auto layout; null takes the limit away. */
@injectable()
export class LimitsStep implements WriteStep {
  readonly keys = STEP_KEYS.limits;
  readonly capability = CAPABILITY.size;
  readonly #assign;
  readonly #values;

  constructor(assign = inject(ASSIGN), values = inject(STEP_VALUES)) {
    this.#assign = assign;
    this.#values = values;
  }

  write(node: SceneNode, props: FigmaProps): void {
    this.#assign.set(node as FrameNode, {
      minWidth: this.#limit(props.minWidth),
      maxWidth: this.#limit(props.maxWidth),
      minHeight: this.#limit(props.minHeight),
      maxHeight: this.#limit(props.maxHeight),
    });
  }

  #limit(value: Limit): number | null | undefined {
    return value === null ? null : this.#values.number(value);
  }
}
