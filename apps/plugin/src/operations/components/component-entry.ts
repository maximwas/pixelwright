import type { OperationOutput } from "@pixelwright/core";
import { pageOf } from "../../figma/nodes.ts";
import { errorMessage } from "../../utils/error-message.ts";

export type ComponentEntry = OperationOutput<"components">["components"][number];
export type ComponentOwner = ComponentNode | ComponentSetNode;

/** A component or set as components_read lists it: where it is, its variants, and its properties' definitions. */
export function componentEntryOf(owner: ComponentOwner): ComponentEntry {
  const base = {
    id: owner.id,
    key: owner.key,
    type: owner.type,
    name: owner.name,
    page: pageOf(owner)?.name ?? null,
    remote: owner.remote,
    ...(owner.description === "" || owner.description === undefined ? {} : { description: owner.description }),
    ...(owner.type === "COMPONENT_SET"
      ? {
          variants: owner.children
            .filter((child) => child.type === "COMPONENT")
            .map((variant) => ({
              id: variant.id,
              name: variant.name,
            })),
        }
      : {}),
  };

  try {
    return {
      ...base,
      properties: propertiesOf(owner.componentPropertyDefinitions),
    };
  } catch (error) {
    // Figma refuses the definitions of a set with variant conflicts; the set is still listed, with why.
    return {
      ...base,
      properties: {},
      error: errorMessage(error),
    };
  }
}

/** The definitions by the names Figma shows; an instance's values, when given, are the defaults (as set inside a component). */
export function propertiesOf(
  definitions: ComponentPropertyDefinitions,
  values: ComponentProperties = {},
): ComponentEntry["properties"] {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      const value = values[name]?.value;
      const given = typeof value === "string" || typeof value === "boolean" ? value : definition.defaultValue;

      return [
        // Figma suffixes a non-variant property's name with its id: "Label#12:0".
        name.replace(/#[^#]*$/, ""),
        {
          type: definition.type,
          ...(given === undefined ? {} : { default: given }),
          ...(definition.variantOptions === undefined ? {} : { options: [...definition.variantOptions] }),
        },
      ];
    }),
  );
}
