/** A component property an instance shows a layer's characters or visibility from: the instance, and its key. */
export interface BoundProperty {
  readonly instance: InstanceNode;
  readonly key: string;
}

/**
 * The instance whose component property a layer's characters (or visibility) show, if they show one: the nearest
 * instance above the layer that has the property. A main component's own layer is its own: none.
 */
export function boundProperty(layer: SceneNode, field: "characters" | "visible"): BoundProperty | null {
  const key = (layer.componentPropertyReferences as Record<string, string> | null | undefined)?.[field];

  for (let at = layer.parent; key !== undefined && at !== null; at = at.parent) {
    if (at.type === "INSTANCE" && at.componentProperties[key] !== undefined) {
      return {
        instance: at,
        key,
      };
    }

    if (at.type === "COMPONENT" || at.type === "COMPONENT_SET") {
      return null;
    }
  }

  return null;
}

/** A property's name as people read it: Figma's key without its #id ("Title#1:1" is Title). */
export function propertyName(key: string): string {
  return key.replace(/#[^#]*$/, "");
}
