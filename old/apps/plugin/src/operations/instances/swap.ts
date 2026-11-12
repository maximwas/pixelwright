import type { InstancesInput, InstancesOutput } from "@pixelwright/core";
import type { ComponentIndex } from "../../figma/component-index.ts";
import { type ComponentOwner, ownerOf, valuesOf } from "../../figma/variants.ts";

type Swapped = InstancesOutput["swapped"][number];

/** Whether a component (or its set) is the one a swap names: by name, id, or key:<key>. */
function means(owner: ComponentOwner, main: ComponentNode, name: string): boolean {
  return [owner.name, owner.id, main.id, `key:${owner.key}`, `key:${main.key}`].includes(name);
}

/** The set's variant sharing the most variant values with the old one; its default where none shares any. */
function variantLike(set: ComponentSetNode, values: Readonly<Record<string, string>>): ComponentNode {
  const variants = set.children.filter((child): child is ComponentNode => child.type === "COMPONENT");
  const score = (variant: ComponentNode) =>
    Object.entries(valuesOf(variant)).filter(([property, value]) => values[property] === value).length;
  const best = variants.reduce<ComponentNode | null>(
    (kept, variant) => (kept === null || score(variant) > score(kept) ? variant : kept),
    null,
  );

  return best === null || score(best) === 0 ? set.defaultVariant : best;
}

/** An instance of a swap's `from` made an instance of its `to` (a set's variant like the old one); null for others. */
export async function swapInstance(
  instance: InstanceNode,
  pairs: InstancesInput["swap"],
  { index, dryRun }: { index: ComponentIndex; dryRun: boolean },
): Promise<Swapped | null> {
  const main = await instance.getMainComponentAsync();
  const owner = main === null ? null : ownerOf(main);
  const pair = main === null || owner === null ? undefined : pairs.find(({ from }) => means(owner, main, from));

  if (main === null || owner === null || pair === undefined) {
    return null;
  }

  const target = await index.find(pair.to);
  const variant = target.type === "COMPONENT_SET" ? variantLike(target, valuesOf(main)) : target;
  // A swap renames the instance after its new component: the answer names it as it was.
  const name = instance.name;

  if (!dryRun && variant.id !== main.id) {
    instance.swapComponent(variant);
  }

  return {
    id: instance.id,
    name,
    from: owner.name,
    to: target.name,
  };
}
