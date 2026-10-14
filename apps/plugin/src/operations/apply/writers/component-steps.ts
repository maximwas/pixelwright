import { type ApplyChange, closest, type FigmaProps } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import type { ComponentIndex } from "../../../figma/component-index.ts";
import { type ComponentOwner, ownerOf, valuesOf, variantFor, variantName } from "../../../figma/variants.ts";
import { WriteError } from "../../../figma/write-error.ts";

/** What a change writes of a layer's component, and the property its error names. */
export interface ComponentStep {
  readonly key: keyof FigmaProps;
  readonly run: () => Promise<void> | void;
}

/**
 * A new instance is made of its component and variant; an existing one or a copy swaps them, then its properties. A
 * component takes a variant as its name; any other layer has no component.
 */
export function componentSteps(node: SceneNode, change: ApplyChange, components: ComponentIndex): ComponentStep[] {
  const { component, variant, props } = change.props;
  const made = change.kind === "create" && change.copyOf === undefined;

  return [
    ...(made ? [] : instanceSteps(node, component, variant, components)),
    ...(node.type === "COMPONENT" && variant !== undefined
      ? [step("variant", () => assign(node, "name", variantName(variant)))]
      : []),
    ...(node.type !== "INSTANCE" && node.type !== "COMPONENT" && (component !== undefined || variant !== undefined)
      ? [step(component === undefined ? "variant" : "component", () => refuseComponent(node))]
      : []),
    ...(props === undefined
      ? []
      : [step("props", () => (node.type === "INSTANCE" ? setProps(node, props, components) : refuseProps(node)))]),
  ];
}

/** An existing instance or a copy swaps its component, or sets its variant. */
function instanceSteps(
  node: SceneNode,
  component: string | undefined,
  variant: FigmaProps["variant"],
  components: ComponentIndex,
): ComponentStep[] {
  if (node.type !== "INSTANCE") {
    return [];
  }

  if (component !== undefined) {
    return [step("component", () => swapTo(node, component, variant, components))];
  }

  return variant === undefined ? [] : [step("variant", () => setVariant(node, variant))];
}

const step = (key: keyof FigmaProps, run: ComponentStep["run"]): ComponentStep => ({
  key,
  run,
});

function refuseProps(node: SceneNode): never {
  throw new WriteError(`A ${node.type.toLowerCase()} has no properties: props set an <Instance>'s.`);
}

function refuseComponent(node: SceneNode): never {
  throw new WriteError(`A ${node.type.toLowerCase()} has no component: component and variant make an <Instance>.`);
}

/** An instance's own component, and what holds its properties. */
async function mainOf(node: InstanceNode): Promise<{ main: ComponentNode; owner: ComponentOwner }> {
  const main = await node.getMainComponentAsync();

  if (main === null) {
    throw new WriteError(`${node.id}'s component is gone: Figma cannot change its variant or props.`);
  }

  return {
    main,
    owner: ownerOf(main),
  };
}

/** An instance swapped to another component: the variant it has where the new one has the same values. */
async function swapTo(
  node: InstanceNode,
  name: string,
  wanted: FigmaProps["variant"],
  index: ComponentIndex,
): Promise<void> {
  const owner = await index.find(name);
  const { main } = await mainOf(node);
  const keep = owner.type === "COMPONENT_SET" && main.parent?.id === owner.id ? valuesOf(main) : {};

  node.swapComponent(
    variantFor(owner, {
      ...keep,
      ...wanted,
    }),
  );
}

/** An instance's variant values, each checked against its set's options. */
async function setVariant(node: InstanceNode, wanted: Readonly<Record<string, string>>): Promise<void> {
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
async function setProps(
  node: InstanceNode,
  wanted: Readonly<Record<string, string>>,
  index: ComponentIndex,
): Promise<void> {
  const own = node.componentProperties;
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

    values[key] = await propertyValue(own[key]?.type, value, index);
  }

  node.setProperties(values);
}

/** A property's value as Figma takes it: a swap names a component by its id, a boolean is true or false. */
async function propertyValue(
  type: string | undefined,
  value: string,
  index: ComponentIndex,
): Promise<string | boolean> {
  if (type === "INSTANCE_SWAP") {
    const owner = await index.find(value);

    return (owner.type === "COMPONENT_SET" ? owner.defaultVariant : owner).id;
  }

  return type === "BOOLEAN" ? value === "true" : value;
}
