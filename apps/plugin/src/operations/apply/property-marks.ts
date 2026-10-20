import { propertyName } from "../../figma/component-properties.ts";
import { type ComponentOwner, ownerOf } from "../../figma/variants.ts";
import { WriteError } from "../../figma/write-error.ts";
import type { AddedProperty, ApplyReport } from "./apply-report.ts";
import type { PropertyMark } from "./writers/write-scope.ts";

/** A property a layer is bound to: the field of the layer it drives, Figma's type for it, and its name. */
interface Wanted {
  readonly field: "characters" | "visible" | "mainComponent";
  readonly type: AddedProperty["type"];
  readonly name: string;
}

/** What each of a mark's names binds: prop the characters, visibleProp the visibility, swapProp the component. */
const KINDS = [
  ["text", "characters", "TEXT"],
  ["visible", "visible", "BOOLEAN"],
  ["swap", "mainComponent", "INSTANCE_SWAP"],
] as const;

/**
 * Properties the layers of a component make (a new one's, an existing one's), bound once the component (or the set it
 * joined) is complete: one the component or set has by that name and type already (a copy's, another variant's, its
 * own) is bound, never made twice; one it lacks is added, the layer's value now its default.
 */
export class PropertyMarks {
  readonly #marks: PropertyMark[] = [];
  /** Where the properties added and the layers bound are told. */
  readonly #report: Pick<ApplyReport, "added" | "wroteTo">;

  constructor(report: Pick<ApplyReport, "added" | "wroteTo">) {
    this.#report = report;
  }

  add(mark: PropertyMark): void {
    this.#marks.push(mark);
  }

  /** Binds the marks outside these layers, which hold sets still open; those inside wait for their set. */
  async bindOutside(open: ReadonlySet<string>): Promise<void> {
    const marks = this.#marks.splice(0);

    this.#marks.push(...marks.filter(({ node }) => within(node, open)));

    for (const mark of marks.filter(({ node }) => !within(node, open))) {
      try {
        await this.#bind(mark);
      } catch (error) {
        mark.fail(error);
      }
    }
  }

  async #bind({ node, property }: PropertyMark): Promise<void> {
    const owner = ownerOf(componentHolding(node.parent));
    const wanted = wantedOf(node.type, property);
    // Every name checked before one is added: a mark refused adds nothing.
    const keys = wanted.map((one) => keyFor(owner, one));
    const references = { ...(node.componentPropertyReferences ?? {}) };

    for (const [index, one] of wanted.entries()) {
      references[one.field] = keys[index] ?? (await this.#add(owner, node, one));
    }

    node.componentPropertyReferences = references;
    this.#report.wroteTo(node);
  }

  async #add(owner: ComponentOwner, node: SceneNode, wanted: Wanted): Promise<string> {
    const key = owner.addComponentProperty(wanted.name, wanted.type, await defaultOf(node, wanted));

    this.#report.added({
      component: owner.id,
      name: wanted.name,
      type: wanted.type,
    });

    return key;
  }
}

/**
 * A dry run's look at a mark: the properties it would add to the component holding `from` (the layer's parent, or the
 * existing layer a new one goes in), what the real run refuses thrown. Nothing is written.
 */
export function plannedProperties(
  from: BaseNode | null,
  type: NodeType,
  property: PropertyMark["property"],
): AddedProperty[] {
  const owner = ownerOf(componentHolding(from));

  return wantedOf(type, property)
    .filter((wanted) => keyFor(owner, wanted) === undefined)
    .map(({ name, type: kind }) => ({
      component: owner.id,
      name,
      type: kind,
    }));
}

/** The properties a mark asks for, each on the kind of layer it drives. */
function wantedOf(type: NodeType, property: PropertyMark["property"]): Wanted[] {
  if (property.text !== undefined && type !== "TEXT") {
    throw new WriteError("prop makes a text property: it goes on a <Text>.", "Use visibleProp on other layers.");
  }

  if (property.swap !== undefined && type !== "INSTANCE") {
    throw new WriteError("swapProp makes an instance swap property: it goes on an <Instance>.");
  }

  return KINDS.flatMap(([key, field, kind]) => {
    const name = property[key];

    return name === undefined
      ? []
      : [
          {
            field,
            type: kind,
            name,
          },
        ];
  });
}

/** The component holding a layer, from this one up: one an instance holds is its main component's, which makes none. */
function componentHolding(from: BaseNode | null): ComponentNode {
  for (let up = from; up !== null; up = up.parent) {
    if (up.type === "COMPONENT") {
      return up;
    }

    if (up.type === "INSTANCE") {
      throw new WriteError(
        "This layer is inside an instance: prop, visibleProp and swapProp bind a component's own layers.",
        "Give them on the main component's layer, by its id.",
      );
    }
  }

  throw new WriteError(
    "No component holds this layer: prop, visibleProp and swapProp bind a component's layers to its properties.",
  );
}

/** The key of the owner's property of this name and type, if it has one; a property of another type by it refuses. */
function keyFor(owner: ComponentOwner, { name, type }: Wanted): string | undefined {
  const definitions = owner.componentPropertyDefinitions;
  const named = Object.keys(definitions).filter((key) => propertyName(key) === name);
  const other = named.find((key) => definitions[key]?.type !== type);

  if (other !== undefined) {
    throw new WriteError(
      `${owner.name} has a ${definitions[other]?.type.toLowerCase().replace("_", " ")} property ${name}: another kind cannot take its name.`,
      "Name the property otherwise.",
    );
  }

  return named[0];
}

/** A new property's default, the layer's value now: its characters, whether it shows, the component it is of. */
async function defaultOf(node: SceneNode, { field }: Wanted): Promise<string | boolean> {
  if (field === "visible") {
    return node.visible;
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
