import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** The layer's name; a text named keeps it, though a new one would take its characters' name (FX-039). */
@injectable()
export class NameStep implements WriteStep {
  readonly keys = STEP_KEYS.name;
  readonly capability = null;
  readonly #assign;
  readonly #capabilities;

  constructor(assign = inject(ASSIGN), capabilities = inject(CAPABILITIES)) {
    this.#assign = assign;
    this.#capabilities = capabilities;
  }

  write(node: SceneNode, { name }: FigmaProps): void {
    this.#assign.set(node, { name });

    if (this.#capabilities.has(node, CAPABILITY.text)) {
      this.#assign.set(node as TextNode, { autoRename: false });
    }
  }
}
