import { InjectionToken, injectable } from "@needle-di/core";
import { PLAN_VALUE } from "@/core/apply/plan/plan.constants.ts";
import type { Assessment } from "@/core/apply/plan/plan.types.ts";
import { CSS_PROPERTY } from "@/core/css/css.constants.ts";
import { DISPLAY_MODE, LAYOUT_VALUE } from "@/core/css/groups/layout/layout.constants.ts";

/** Whether nothing lays a layer out where it goes, so its edges place it (C-174, B-025). */
@injectable()
export class PlacedLayers {
  /**
   * A parent element without auto layout (a section, a frame displayed as a block), or the page a top-level layer is
   * on. A new top-level layer is placed by its edges too: where the call's parent lays it out, the plugin refuses them.
   */
  isPlaced({ element, entry }: Assessment, byRef: ReadonlyMap<string, Assessment>): boolean {
    const parent = element.parent === null ? undefined : byRef.get(element.parent);

    if (parent === undefined) {
      return element.parent === null && (element.id === null || entry?.parent === null);
    }

    const display = parent.element.attributes[CSS_PROPERTY.display];
    // A parent hidden by display="none" keeps the layout it has.
    const shown = (display === PLAN_VALUE.none ? undefined : display) ?? parent.now?.current[CSS_PROPERTY.display];
    const mode = DISPLAY_MODE[shown ?? PLAN_VALUE.block];

    return mode !== LAYOUT_VALUE.flex && mode !== LAYOUT_VALUE.grid;
  }
}

export const PLACED_LAYERS = new InjectionToken<PlacedLayers>("PlacedLayers");
