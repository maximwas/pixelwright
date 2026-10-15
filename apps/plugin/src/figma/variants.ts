import { WriteError } from "./write-error.ts";

/** What holds a component's properties: its set, or the lone component itself. */
export type ComponentOwner = ComponentNode | ComponentSetNode;

/** What holds a component's properties: a set holds its variants'. */
export function ownerOf(component: ComponentNode): ComponentOwner {
  return component.parent?.type === "COMPONENT_SET" ? (component.parent as ComponentSetNode) : component;
}

/** A variant's values, from Figma or from its name ("Size=Large, State=Default"). */
export function valuesOf(component: ComponentNode): Record<string, string> {
  const given = (component as { variantProperties?: Record<string, string> | null }).variantProperties;

  return (
    given ??
    Object.fromEntries(
      component.name
        .split(",")
        .map((part) => part.split("=").map((item) => item.trim()))
        .filter((pair): pair is [string, string] => pair.length === 2),
    )
  );
}

/** A variant's name as Figma writes it. */
export function variantName(values: Readonly<Record<string, string>>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
}

/** The component an instance is made of: a lone component, or the set's variant with these values (the rest its default's). */
export function variantFor(owner: ComponentOwner, wanted: Readonly<Record<string, string>>): ComponentNode {
  if (owner.type === "COMPONENT") {
    if (Object.keys(wanted).length > 0) {
      throw new WriteError(`${owner.name} is a component without variants: give no variant.`);
    }

    return owner;
  }

  const target = {
    ...valuesOf(owner.defaultVariant),
    ...wanted,
  };
  const variants = owner.children.filter((child): child is ComponentNode => child.type === "COMPONENT");
  const found = variants.find((child) =>
    Object.entries(target).every(([name, value]) => valuesOf(child)[name] === value),
  );

  if (found === undefined) {
    throw new WriteError(
      `${owner.name} has no variant ${variantName(wanted)}: it has ${variants.map((child) => child.name).join("; ")}.`,
    );
  }

  return found;
}
