import { type ComponentOwner, ownerOf } from "../../figma/variants.ts";
import { WriteError } from "../../figma/write-error.ts";
import type { PropertyMark } from "./writers/write-scope.ts";

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
  bindOutside(open: ReadonlySet<string>): void {
    const marks = this.#marks.splice(0);

    this.#marks.push(...marks.filter(({ node }) => within(node, open)));

    for (const mark of marks.filter(({ node }) => !within(node, open))) {
      try {
        bind(mark);
      } catch (error) {
        mark.fail(error);
      }
    }
  }
}

function bind({ node, property }: PropertyMark): void {
  const owner = ownerOf(componentHolding(node));
  const references = { ...(node.componentPropertyReferences ?? {}) };

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
}

/** The new component a layer is in. */
function componentHolding(node: SceneNode): ComponentNode {
  for (let up = node.parent; up !== null; up = up.parent) {
    if (up.type === "COMPONENT") {
      return up;
    }
  }

  throw new WriteError("prop and visibleProp make a property of the new <Component> holding the layer.");
}

/** The property of this name and type the owner has, else one made for it. */
function keyFor(owner: ComponentOwner, name: string, type: "TEXT" | "BOOLEAN", fallback: string | boolean): string {
  const definitions = owner.componentPropertyDefinitions;
  const found = Object.keys(definitions).find(
    (key) => key.replace(/#[^#]*$/, "") === name && definitions[key]?.type === type,
  );

  return found ?? owner.addComponentProperty(name, type, fallback);
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
