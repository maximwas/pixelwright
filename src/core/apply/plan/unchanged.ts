import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { ApplyElement } from "@/core/apply/apply.types.ts";
import type { LayerEntry, LayerNow } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { CSS_READER } from "@/core/css/css-reader.ts";

/**
 * Which of an element's attributes the layer already has, judged in CSS space (D-19, C-170): the layer is read as CSS
 * through the same property groups design_read uses, so the reader's rounding is included, and an attribute equal to
 * what was read is not written again. A top-level element is compared with the layer as the read's root and as its
 * parent's child, since design_read writes either; a nested one only as its parent holds it. A hidden layer is read
 * as shown, so what it has is known when it is shown again.
 */
@injectable()
export class Unchanged {
  readonly #reader;

  constructor(reader = inject(CSS_READER)) {
    this.#reader = reader;
  }

  of(element: ApplyElement, entry: LayerEntry): LayerNow {
    const { layer, parent, model } = entry;
    const shown = layer.visible ? layer : { ...layer, visible: true };
    const nested = element.parent !== null && parent !== null;
    const renders = [
      nested ? null : this.#reader.read(shown, null, model),
      parent === null ? null : this.#reader.read(shown, parent, model),
    ]
      .filter((render) => render !== null)
      .map(({ properties }) => new Map(properties));
    const attributes = new Set(
      Object.entries(element.attributes)
        .filter(([name, given]) => renders.some((render) => render.get(name) === given))
        .map(([name]) => name),
    );

    if (!layer.visible) {
      // Rendered as shown, but its display is none now: any display given shows it.
      attributes.delete(CSS_PROPERTY.display);
    }

    const wanted = element.content?.map(({ value }) => value).join("");

    return {
      attributes,
      text: wanted === undefined || layer.text?.characters === wanted,
      visible: layer.visible,
      current: Object.fromEntries(renders.at(-1) ?? []),
    };
  }
}

export const UNCHANGED = new InjectionToken<Unchanged>("Unchanged");
