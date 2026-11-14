import { InjectionToken, injectable } from "@needle-di/core";
import { LAYER_ID_PART, LAYER_ID_TEXT } from "@/core/kernel/ids/ids.constants.ts";

/**
 * A slot's default content (T-170, K-030, FX-033): while a slot follows its component, its layers' ids are
 * `I<instance>;<id in the component>`, not under the slot's own id. A layer put in has a plain id, and once the slot is
 * the instance's own Figma re-ids every layer in it `<slot id>;<id>` after the call. Figma gives no flag, so bind
 * leaves default content to the component: writing to it would make the slot the instance's own, silently.
 */
@injectable()
export class SlotContent {
  /** Whether a layer of this id, a child of the slot `slotId`, is the slot's default content. */
  isDefault(id: string, slotId: string): boolean {
    return id.startsWith(LAYER_ID_PART.instance) && !id.startsWith(LAYER_ID_TEXT.under(slotId));
  }
}

export const SLOT_CONTENT = new InjectionToken<SlotContent>("SlotContent");
