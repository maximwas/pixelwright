import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A component's or a component set's description (0.7.0's annotation steps); any other layer has none. */
@injectable()
export class DescriptionStep implements WriteStep {
  readonly keys = STEP_KEYS.description;
  readonly capability = null;
  readonly #assign;

  constructor(assign = inject(ASSIGN)) {
    this.#assign = assign;
  }

  check(_props: FigmaProps, layer: TypedLayer): void {
    if (layer.type !== FIGMA_NODE_TYPE.component && layer.type !== FIGMA_NODE_TYPE.componentSet) {
      throw new WriteError(WRITERS_TEXT.description);
    }
  }

  write(node: SceneNode, { description }: FigmaProps): void {
    this.#assign.set(node as ComponentNode, { description });
  }
}
