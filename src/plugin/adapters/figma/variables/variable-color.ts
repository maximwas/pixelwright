import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { VARIABLE_VALUE } from "@/plugin/adapters/figma/variables/variables.constants.ts";

/**
 * The colour a colour variable gives a layer (P-093): its value in the layer's mode as Figma resolves it, else its
 * collection's default mode's, aliases followed up to VARIABLE_VALUE.aliasDepth; null when there is none to read.
 */
@injectable()
export class VariableColor {
  readonly #lookup;

  constructor(lookup = inject(NODE_LOOKUP)) {
    this.#lookup = lookup;
  }

  async of(variable: Variable, consumer?: SceneNode): Promise<RGBA | null> {
    if (consumer !== undefined) {
      try {
        const { value } = variable.resolveForConsumer(consumer);

        if (this.#isColour(value)) {
          return value;
        }
      } catch {
        // A layer Figma cannot resolve the variable for: the default mode's value below.
      }
    }

    return await this.#default(variable, VARIABLE_VALUE.aliasDepth);
  }

  async #default(variable: Variable, depth: number): Promise<RGBA | null> {
    const collection = await this.#lookup.collection(variable.variableCollectionId);
    const value: unknown = collection === null ? undefined : variable.valuesByMode[collection.defaultModeId];

    if (this.#isColour(value)) {
      return value;
    }

    if (!this.#isAlias(value) || depth === 0) {
      return null;
    }

    const target = await this.#lookup.variable(value.id);

    return target === null ? null : await this.#default(target, depth - 1);
  }

  #isColour(value: unknown): value is RGBA {
    return typeof value === "object" && value !== null && "r" in value && "a" in value;
  }

  #isAlias(value: unknown): value is VariableAlias {
    return typeof value === "object" && value !== null && "type" in value && value.type === VARIABLE_VALUE.alias;
  }
}

export const VARIABLE_COLOR = new InjectionToken<VariableColor>("VariableColor");
