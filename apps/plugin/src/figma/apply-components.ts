import { closest, type FigmaProps } from "@pixelwright/core";
import { SET_GAP } from "../constants/plugin.ts";
import type { Layer } from "../types/apply.ts";
import { WriteError } from "./write-error.ts";

type Owner = ComponentNode | ComponentSetNode;

/** Components by the names design_read writes (a set's, a lone component's), or `key:<key>` for a library's. */
export interface ComponentIndex {
  find(name: string): Promise<Owner>;
  /** A component or set made in this call, so a later instance finds it. */
  add(owner: Owner): void;
}

/** What a component or a set holds: a set holds its variants' properties. */
export function ownerOf(component: ComponentNode): Owner {
  return component.parent?.type === "COMPONENT_SET" ? (component.parent as ComponentSetNode) : component;
}

/**
 * Looked up as needed: those made in this call, those the current page's instances come from (a library's among
 * them), then the file's own on every page (loaded once), then a library's by key.
 */
export function componentIndex(): ComponentIndex {
  const made = new Map<string, Owner>();
  let used: Map<string, Owner> | null = null;
  let local: Map<string, Owner> | null = null;

  return {
    add: (owner) => {
      made.set(owner.name, owner);
    },
    find: async (name) => {
      if (name.startsWith("key:")) {
        const key = name.slice(4);

        return await figma.importComponentSetByKeyAsync(key).catch(() => figma.importComponentByKeyAsync(key));
      }

      used ??= await usedOwners();

      const found = made.get(name) ?? used.get(name);

      if (found !== undefined) {
        return found;
      }

      local ??= await localOwners();

      const own = local.get(name);

      if (own !== undefined) {
        return own;
      }

      const near = closest(name, new Set([...made.keys(), ...used.keys(), ...local.keys()]));

      throw new WriteError(
        `No component or component set is named ${name} in this file or the libraries its page uses.`,
        near === null
          ? 'components_read lists them; a library one the file does not use yet takes component="key:<key>".'
          : `Did you mean ${near}?`,
      );
    },
  };
}

async function usedOwners(): Promise<Map<string, Owner>> {
  const owners = new Map<string, Owner>();

  for (const instance of figma.currentPage.findAllWithCriteria({ types: ["INSTANCE"] })) {
    const main = await instance.getMainComponentAsync();
    const owner = main === null ? null : ownerOf(main);

    if (owner !== null && !owners.has(owner.name)) {
      owners.set(owner.name, owner);
    }
  }

  return owners;
}

async function localOwners(): Promise<Map<string, Owner>> {
  await figma.loadAllPagesAsync();

  const owners = new Map<string, Owner>();

  for (const node of figma.root.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })) {
    if ((node.type === "COMPONENT_SET" || node.parent?.type !== "COMPONENT_SET") && !owners.has(node.name)) {
      owners.set(node.name, node);
    }
  }

  return owners;
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
export function variantFor(owner: Owner, wanted: Readonly<Record<string, string>>): ComponentNode {
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

/** An instance's own component, and what holds its properties. */
async function mainOf(node: Layer): Promise<{ main: ComponentNode; owner: Owner }> {
  const main = await (node as unknown as InstanceNode).getMainComponentAsync();

  if (main === null) {
    throw new WriteError(`${node.id}'s component is gone: Figma cannot change its variant or props.`);
  }

  return {
    main,
    owner: ownerOf(main),
  };
}

/** An instance swapped to another component: the variant it has where the new one has the same values. */
export async function swapTo(
  node: Layer,
  name: string,
  wanted: FigmaProps["variant"],
  index: ComponentIndex,
): Promise<void> {
  const owner = await index.find(name);
  const { main } = await mainOf(node);
  const keep = owner.type === "COMPONENT_SET" && main.parent?.id === owner.id ? valuesOf(main) : {};

  (node as unknown as InstanceNode).swapComponent(
    variantFor(owner, {
      ...keep,
      ...wanted,
    }),
  );
}

/** An instance's variant values, each checked against its set's options. */
export async function setVariant(node: Layer, wanted: Readonly<Record<string, string>>): Promise<void> {
  const { owner } = await mainOf(node);

  if (owner.type !== "COMPONENT_SET") {
    throw new WriteError(`${owner.name} is a component without variants: give no variant.`);
  }

  const definitions = owner.componentPropertyDefinitions;
  const variants = Object.keys(definitions).filter((name) => definitions[name]?.type === "VARIANT");

  for (const [name, value] of Object.entries(wanted)) {
    const options = definitions[name]?.variantOptions;

    if (definitions[name]?.type !== "VARIANT" || options === undefined) {
      throw new WriteError(`${owner.name} has no variant property ${name}: it has ${variants.join(", ")}.`);
    }

    if (!options.includes(value)) {
      throw new WriteError(`${name} has no value ${value}: it has ${options.join(", ")}.`);
    }
  }

  node.setProperties({ ...wanted });
}

/** An instance's properties by the names design_read writes (without #id): text, "true"/"false", a component's name. */
export async function setProps(
  node: Layer,
  wanted: Readonly<Record<string, string>>,
  index: ComponentIndex,
): Promise<void> {
  const own = (node.componentProperties ?? {}) as Record<string, { type: string }>;
  const keys = new Map(Object.keys(own).map((key) => [key.replace(/#[^#]*$/, ""), key]));
  const values: Record<string, string | boolean> = {};

  for (const [name, value] of Object.entries(wanted)) {
    const key = keys.get(name);

    if (key === undefined) {
      const near = closest(name, keys.keys());

      throw new WriteError(
        `${node.name} has no property ${name}: it has ${[...keys.keys()].join(", ")}.`,
        near === null ? undefined : `Did you mean ${near}?`,
      );
    }

    const type = own[key]?.type;

    if (type === "INSTANCE_SWAP") {
      const owner = await index.find(value);

      values[key] = (owner.type === "COMPONENT_SET" ? owner.defaultVariant : owner).id;
    } else {
      values[key] = type === "BOOLEAN" ? value === "true" : value;
    }
  }

  node.setProperties(values);
}

/**
 * Properties a new component's layers make, bound once the component (or the set it joined) is complete: one the
 * component or set has by that name and type already (a copy's, another variant's) is bound, never made twice.
 */
export function bindProperties(
  marks: readonly { node: Layer; property: NonNullable<FigmaProps["property"]>; fail: (error: unknown) => void }[],
): void {
  const keyFor = (owner: Owner, name: string, type: "TEXT" | "BOOLEAN", fallback: string | boolean) => {
    const definitions = owner.componentPropertyDefinitions;
    const found = Object.keys(definitions).find(
      (key) => key.replace(/#[^#]*$/, "") === name && definitions[key]?.type === type,
    );

    return found ?? owner.addComponentProperty(name, type, fallback);
  };

  for (const { node, property, fail } of marks) {
    try {
      let component: BaseNode | null = node.parent as unknown as BaseNode | null;

      while (component !== null && component.type !== "COMPONENT") {
        component = component.parent;
      }

      if (component === null) {
        throw new WriteError("prop and visibleProp make a property of the new <Component> holding the layer.");
      }

      const owner = ownerOf(component as ComponentNode);
      const references: Record<string, string> = {
        ...((node.componentPropertyReferences as Record<string, string> | null) ?? {}),
      };

      if (property.text !== undefined) {
        if (node.type !== "TEXT") {
          throw new WriteError("prop makes a text property: it goes on a <Text>.", "Use visibleProp on other layers.");
        }

        references.characters = keyFor(owner, property.text, "TEXT", String(node.characters ?? ""));
      }

      if (property.visible !== undefined) {
        references.visible = keyFor(owner, property.visible, "BOOLEAN", true);
      }

      node.componentPropertyReferences = references;
    } catch (error) {
      fail(error);
    }
  }
}

/** A set's variants in a grid: a column per value of its first variant property, a row per the rest. */
export function layOut(set: ComponentSetNode): void {
  const variants = set.children.filter((child): child is ComponentNode => child.type === "COMPONENT");
  const [first] = Object.keys(set.componentPropertyDefinitions).filter(
    (name) => set.componentPropertyDefinitions[name]?.type === "VARIANT",
  );
  const columns = [...new Set(variants.map((variant) => valuesOf(variant)[first ?? ""] ?? ""))];
  const rest = (variant: ComponentNode) =>
    variantName(Object.fromEntries(Object.entries(valuesOf(variant)).filter(([name]) => name !== first)));
  const rows = [...new Set(variants.map(rest))];
  const width = Math.max(...variants.map((variant) => variant.width));
  const height = Math.max(...variants.map((variant) => variant.height));

  for (const variant of variants) {
    variant.x = SET_GAP + columns.indexOf(valuesOf(variant)[first ?? ""] ?? "") * (width + SET_GAP);
    variant.y = SET_GAP + rows.indexOf(rest(variant)) * (height + SET_GAP);
  }

  set.resizeWithoutConstraints(
    SET_GAP + columns.length * (width + SET_GAP),
    SET_GAP + rows.length * (height + SET_GAP),
  );
}
