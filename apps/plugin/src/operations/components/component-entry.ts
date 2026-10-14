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

function propertiesOf(definitions: ComponentPropertyDefinitions): ComponentEntry["properties"] {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => [
      // Figma suffixes a non-variant property's name with its id: "Label#12:0".
      name.replace(/#[^#]*$/, ""),
      {
        type: definition.type,
        ...(definition.defaultValue === undefined ? {} : { default: definition.defaultValue }),
        ...(definition.variantOptions === undefined ? {} : { options: [...definition.variantOptions] }),
      },
    ]),
  );
}
