import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { REFERENCE_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";

/** The ids of the styles and variables layers use. */
export interface UsedIds {
  readonly styles: string[];
  readonly variables: string[];
}

/**
 * What the layers under a layer or page use (P-098): the paint, text and effect styles they name and the variables
 * their fields, paints and effects are bound to, as far as the op's deadline lets the walk go (P-075). shortcut: a
 * text's runs are not read, so a style or variable only one run uses is missed; read the runs if that shows.
 */
@injectable()
export class UsedTokens {
  readonly #walk;

  constructor(walk = inject(LAYER_WALK)) {
    this.#walk = walk;
  }

  under(root: BaseNode, deadline: number): UsedIds {
    const roots: readonly SceneNode[] =
      root.type === FIGMA_NODE_TYPE.page ? root.children : root.type === FIGMA_NODE_TYPE.document ? [] : [root];
    const { kept } = this.#walk.until(this.#walk.layers(roots), deadline, {
      accepts: (layer) => this.#styleIds(layer).length > 0 || this.#bound(layer) !== undefined,
      enough: Number.POSITIVE_INFINITY,
    });

    return {
      styles: [...new Set(kept.flatMap((layer) => this.#styleIds(layer)))],
      variables: [...new Set(kept.flatMap((layer) => this.aliases(this.#bound(layer))))],
    };
  }

  /** The variable ids values point at: each alias `{ type: "VARIABLE_ALIAS", id }` anywhere in them, depth first. */
  aliases(values: unknown): string[] {
    if (Array.isArray(values)) {
      return values.flatMap((value) => this.aliases(value));
    }

    if (typeof values !== "object" || values === null) {
      return [];
    }

    if ("type" in values && values.type === REFERENCE_FIELD.alias && "id" in values && typeof values.id === "string") {
      return [values.id];
    }

    return Object.values(values).flatMap((value) => this.aliases(value));
  }

  #styleIds(layer: SceneNode): string[] {
    return REFERENCE_FIELD.styleFields.flatMap((field) => {
      const id: unknown = Reflect.get(layer, field);

      return typeof id === "string" && id !== "" ? [id] : [];
    });
  }

  /** The variables bound to the layer's fields, paints and effects; none when it has no binding. */
  #bound(layer: SceneNode): object | undefined {
    const bound = "boundVariables" in layer ? layer.boundVariables : undefined;

    return bound === undefined || Object.keys(bound).length === 0 ? undefined : bound;
  }
}

export const USED_TOKENS = new InjectionToken<UsedTokens>("UsedTokens");
