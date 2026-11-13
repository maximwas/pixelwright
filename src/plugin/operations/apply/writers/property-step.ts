import { inject, injectable } from "@needle-di/core";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { PROPERTY_MARKS } from "@/plugin/operations/apply/property-marks.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * The text, visibility or instance swap property a component's layer makes (T-129): checked as the layer is, bound
 * once its component is whole (PropertyMarks), as its default is the layer's value after the call wrote it.
 */
@injectable()
export class PropertyStep implements WriteStep {
  readonly keys = STEP_KEYS.property;
  readonly capability = null;
  readonly #marks;

  constructor(marks = inject(PROPERTY_MARKS)) {
    this.#marks = marks;
  }

  /** What the mark refuses, on either run; once it passes, the names it asks are held against the call's next layers. */
  check({ property }: FigmaProps, layer: TypedLayer): void {
    if (property !== undefined) {
      this.#marks.check(layer, property);
      this.#marks.claim(layer, property);
    }
  }

  /** A mark that cannot bind makes no layer: its place is asked before the layer is made. */
  place({ property }: FigmaProps, layer: TypedLayer): void {
    if (property !== undefined) {
      this.#marks.check(layer, property);
    }
  }

  write(node: SceneNode, { property }: FigmaProps): void {
    if (property !== undefined) {
      this.#marks.add(node, property);
    }
  }
}
