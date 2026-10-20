import { propertyName } from "../../figma/component-properties.ts";
import { type ComponentOwner, ownerOf } from "../../figma/variants.ts";
import { WriteError } from "../../figma/write-error.ts";
import type { PropertyMark } from "./writers/write-scope.ts";

/** A property a layer is bound to: the field of the layer it drives, Figma's type for it, and its name. */
interface Wanted {
  readonly field: "characters" | "visible" | "mainComponent";
  readonly type: "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  readonly name: string;
}

/**
 * Properties a new component's layers make, bound once the component (or the set it joined) is complete: one the
 * component or set has by that name and type already (a copy's, another variant's) is bound, never made twice.
 */
export class PropertyMarks {
  readonly #marks: PropertyMark[] = [];

  add(mark: PropertyMark): void {
    this.#marks.push(mark);
  }

  /** Binds the marks outside these layers, which hold sets still open; those inside wait for their set. */
  async bindOutside(open: ReadonlySet<string>): Promise<void> {
    const marks = this.#marks.splice(0);

    this.#marks.push(...marks.filter(({ node }) => within(node, open)));

    for (const mark of marks.filter(({ node }) => !within(node, open))) {
      try {
        await bind(mark);
      } catch (error) {
        mark.fail(error);
      }
    }
  }
}

async function bind({ node, property }: PropertyMark): Promise<void> {
  const owner = ownerOf(componentHolding(node));
  const references = { ...(node.componentPropertyReferences ?? {}) };

  for (const wanted of wantedOf(node, property)) {
    references[wanted.field] =
      keyFor(owner, wanted) ?? owner.addComponentProperty(wanted.name, wanted.type, await defaultOf(node, wanted));
  }

  node.componentPropertyReferences = references;
}

/** The properties a mark asks for, each on the kind of layer it drives. */
function wantedOf(node: SceneNode, { text, visible, swap }: PropertyMark["property"]): Wanted[] {
  if (text !== undefined && node.type !== "TEXT") {
    throw new WriteError("prop makes a text property: it goes on a <Text>.", "Use visibleProp on other layers.");
  }

  if (swap !== undefined && node.type !== "INSTANCE") {
    throw new WriteError("swapProp makes an instance swap property: it goes on an <Instance>.");
  }

  return [
    ...(text === undefined
      ? []
      : [
          {
            field: "characters",
            type: "TEXT",
            name: text,
          } as const,
        ]),
    ...(visible === undefined
      ? []
      : [
          {
            field: "visible",
            type: "BOOLEAN",
            name: visible,
          } as const,
        ]),
    ...(swap === undefined
      ? []
      : [
          {
            field: "mainComponent",
            type: "INSTANCE_SWAP",
            name: swap,
          } as const,
        ]),
  ];
}

/** The new component a layer is in. */
function componentHolding(node: SceneNode): ComponentNode {
  for (let up = node.parent; up !== null; up = up.parent) {
    if (up.type === "COMPONENT") {
      return up;
    }
  }

  throw new WriteError("prop, visibleProp and swapProp make a property of the new <Component> holding the layer.");
}

/** The key of the owner's property of this name and type, if it has one. */
function keyFor(owner: ComponentOwner, { name, type }: Wanted): string | undefined {
  const definitions = owner.componentPropertyDefinitions;

  return Object.keys(definitions).find((key) => propertyName(key) === name && definitions[key]?.type === type);
}

/** A new property's default: the layer's characters, shown, or the component its instance is of. */
async function defaultOf(node: SceneNode, { field }: Wanted): Promise<string | boolean> {
  if (field === "visible") {
    return true;
  }

  if (field === "characters") {
    return node.type === "TEXT" ? node.characters : "";
  }

  const main = node.type === "INSTANCE" ? await node.getMainComponentAsync() : null;

  if (main === null) {
    throw new WriteError(`${node.name}'s component is gone: it cannot be the swap property's default.`);
  }

  return main.id;
}

/** Whether a layer is inside one of these. */
function within(node: BaseNode, ids: ReadonlySet<string>): boolean {
  for (let up = node.parent; up !== null; up = up.parent) {
    if (ids.has(up.id)) {
      return true;
    }
  }

  return false;
}
