import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES, type TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_VALUES } from "@/plugin/operations/apply/writers/step-values.ts";
import { CORNERS, STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** A layer's corner radius: one, or one per corner on the layers that have them. */
@injectable()
export class CornersStep implements WriteStep {
  readonly keys = STEP_KEYS.corners;
  readonly capability = CAPABILITY.corners;
  readonly #assign;
  readonly #values;
  readonly #capabilities;

  constructor(
    assign = inject(ASSIGN),
    values = inject(STEP_VALUES),
    capabilities = inject(CAPABILITIES),
  ) {
    this.#assign = assign;
    this.#values = values;
    this.#capabilities = capabilities;
  }

  check({ cornerRadius }: FigmaProps, layer: TypedLayer): void {
    if (Array.isArray(cornerRadius)) {
      this.#capabilities.require(layer, CAPABILITY.cornerSides);
    }
  }

  write(node: SceneNode, { cornerRadius }: FigmaProps): void {
    const layer = node as RectangleNode;

    if (!Array.isArray(cornerRadius)) {
      this.#assign.set(layer, { cornerRadius: this.#values.number(cornerRadius) });

      return;
    }

    this.#assign.set(
      layer,
      Object.fromEntries(CORNERS.map((field, index) => [field, this.#values.number(cornerRadius[index])])),
    );
  }
}
