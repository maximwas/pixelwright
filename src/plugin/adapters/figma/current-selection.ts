import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_EVENT } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_REFS } from "@/plugin/adapters/figma/layer-refs.ts";
import type { NodeRef } from "@/shared/ops/selection/selection.schema.ts";

/** What the user selected on the current page (T-030), each layer with its box in page px, rounded. */
@injectable()
export class CurrentSelection {
  readonly #refs;

  constructor(refs = inject(LAYER_REFS)) {
    this.#refs = refs;
  }

  nodes(): NodeRef[] {
    return figma.currentPage.selection.map((node) => this.#refs.ref(node));
  }

  /** Selects these layers of the current page in place of what was selected (T-032). */
  select(layers: readonly SceneNode[]): void {
    figma.currentPage.selection = layers;
  }

  /** Calls `listener` at each change of the selection until the function it returns is called (P-111). */
  onChange(listener: () => void): () => void {
    figma.on(FIGMA_EVENT.selectionChange, listener);

    return () => figma.off(FIGMA_EVENT.selectionChange, listener);
  }
}

export const CURRENT_SELECTION = new InjectionToken<CurrentSelection>("CurrentSelection");
