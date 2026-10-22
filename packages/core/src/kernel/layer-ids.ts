/**
 * Whether a layer in an instance's slot is the slot's default content, still following the component, as Figma ids it
 * (live, 2026-10-20): I<instance>;<its id in the component>. Changing it, or putting a layer in (a plain id), makes the
 * slot the instance's own, with no override: later changes to the component no longer reach it, and once that call
 * ends Figma gives all the slot's layers ids under the slot's own (<the slot's id>;<id>), as in a copied instance.
 */
export function isDefaultSlotContent(id: string, slotId: string): boolean {
  return id.startsWith("I") && !id.startsWith(`${slotId};`);
}

/** Whether a layer id names a layer inside the instance: I<instance>;… for a top one, <its id>;… for a nested one. */
export function isInInstance(id: string, instanceId: string): boolean {
  return id.startsWith(`${instanceId.startsWith("I") ? instanceId : `I${instanceId}`};`);
}
