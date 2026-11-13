import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import type { ComponentOwner } from "@/plugin/adapters/figma/components/components.types.ts";
import { VARIANTS } from "@/plugin/adapters/figma/components/variants.ts";
import { CAPABILITY_TEXT, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT, PROPERTY_FIELD, PROPERTY_KINDS } from "@/plugin/operations/apply/apply.constants.ts";
import { PROPERTY_KEY } from "@/shared/read-model/read-model.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Property = NonNullable<FigmaProps["property"]>;

type Kind = (typeof PROPERTY_KINDS)[number];

/** A property a layer is bound to: the field of the layer it drives, Figma's type for it, and its name. */
interface Wanted {
  readonly field: Kind["field"];
  readonly type: Kind["type"];
  readonly name: string;
}

/** A layer's mark waiting for its component to be whole. */
interface Mark {
  readonly node: SceneNode;
  readonly property: Property;
}

/** The layers bound, and those whose binding was refused, with why. */
export interface MarksBound {
  readonly bound: SceneNode[];
  readonly failed: { readonly node: SceneNode; readonly error: unknown }[];
}

/**
 * The properties components' layers make with prop, visibleProp and swapProp (T-129, P-146), a new component's and an
 * existing one's, bound once the component (or the set it joins) is whole: one it has by that name and type already is
 * bound, never made twice; one it lacks is added once, the layer's value now its default; a name of another type is
 * refused before anything is added (FX-027: Figma would add a duplicate). One call's marks, started again by the next.
 */
@injectable()
export class PropertyMarks {
  readonly #marks: Mark[] = [];
  readonly #variants;
  readonly #assign;

  constructor(variants = inject(VARIANTS), assign = inject(ASSIGN)) {
    this.#variants = variants;
    this.#assign = assign;
  }

  start(): void {
    this.#marks.splice(0);
  }

  /**
   * What binding refuses, found without writing: the kind of layer each name goes on, what holds the layer (a new one's
   * parent chain runs through the stand-ins a dry run keeps) and the properties it has by those names.
   */
  check(layer: TypedLayer, property: Property): void {
    const wanted = this.#wanted(layer.type, property);
    const holder = this.#holder(layer.parent);

    // A component this call makes (a stand-in, with no id) has no properties yet: nothing to clash with.
    if ("id" in holder) {
      const owner = this.#variants.owner(holder as ComponentNode);

      for (const one of wanted) {
        this.#keyFor(owner, one);
      }
    }
  }

  add(node: SceneNode, property: Property): void {
    this.#marks.push({ node, property });
  }

  /** Binds the marks outside these layers, which hold sets still open; those inside wait for their set. */
  async bind(open: ReadonlySet<string>): Promise<MarksBound> {
    const ready = this.#marks.filter(({ node }) => !this.#within(node, open));
    const done: MarksBound = { bound: [], failed: [] };

    this.#marks.splice(0, this.#marks.length, ...this.#marks.filter(({ node }) => this.#within(node, open)));

    for (const mark of ready) {
      try {
        await this.#bind(mark);
        done.bound.push(mark.node);
      } catch (error) {
        done.failed.push({ node: mark.node, error });
      }
    }

    return done;
  }

  async #bind({ node, property }: Mark): Promise<void> {
    const owner = this.#variants.owner(this.#holder(node.parent) as ComponentNode);
    const wanted = this.#wanted(node.type, property);
    // Every name checked before one is added: a mark refused adds nothing.
    const keys = wanted.map((one) => this.#keyFor(owner, one));
    const references: Record<string, string> = { ...(node as FrameNode).componentPropertyReferences };

    for (const [index, one] of wanted.entries()) {
      references[one.field] =
        keys[index] ?? owner.addComponentProperty(one.name, one.type, await this.#default(node, one));
    }

    this.#assign.set(node as FrameNode, { componentPropertyReferences: references });
  }

  /** The properties a mark asks for, each on the kind of layer it drives. */
  #wanted(type: string, property: Property): Wanted[] {
    if (property.text !== undefined && type !== FIGMA_NODE_TYPE.text) {
      throw new WriteError(APPLY_TEXT.propOnText, APPLY_TEXT.propHint);
    }

    if (property.swap !== undefined && type !== FIGMA_NODE_TYPE.instance) {
      throw new WriteError(APPLY_TEXT.swapOnInstance);
    }

    return PROPERTY_KINDS.flatMap(({ key, field, type: kind }) => {
      const name = property[key];

      return name === undefined ? [] : [{ field, type: kind, name }];
    });
  }

  /** The component holding a layer, from its parent up; an instance's layers bind none. */
  #holder(from: TypedLayer | null | undefined): TypedLayer {
    for (let up = from; up !== undefined && up !== null; up = up.parent) {
      if (up.type === FIGMA_NODE_TYPE.component) {
        return up;
      }

      if (up.type === FIGMA_NODE_TYPE.instance) {
        throw new WriteError(APPLY_TEXT.markInInstance, APPLY_TEXT.markInInstanceHint);
      }
    }

    throw new WriteError(APPLY_TEXT.noComponent);
  }

  /** The key of the owner's property of this name and type, if it has one; one of another type by it refuses. */
  #keyFor(owner: ComponentOwner, { name, type }: Wanted): string | undefined {
    const definitions = owner.componentPropertyDefinitions;
    const named = Object.keys(definitions).filter((key) => PROPERTY_KEY.name(key) === name);
    const other = named.find((key) => definitions[key]?.type !== type);

    if (other !== undefined) {
      const kind = CAPABILITY_TEXT.type(definitions[other]?.type ?? "");

      throw new WriteError(APPLY_TEXT.otherKind(owner.name, kind, name), APPLY_TEXT.otherKindHint);
    }

    return named[0];
  }

  /** A new property's default, the layer's value now: its characters, whether it shows, the component it is of. */
  async #default(node: SceneNode, { field }: Wanted): Promise<string | boolean> {
    if (field === PROPERTY_FIELD.visible) {
      return node.visible;
    }

    if (field === PROPERTY_FIELD.characters) {
      return node.type === FIGMA_NODE_TYPE.text ? node.characters : "";
    }

    const main = node.type === FIGMA_NODE_TYPE.instance ? await node.getMainComponentAsync() : null;

    if (main === null) {
      throw new WriteError(APPLY_TEXT.swapGone(node.name));
    }

    return main.id;
  }

  /** Whether a layer is inside one of these. */
  #within(node: BaseNode, ids: ReadonlySet<string>): boolean {
    for (let up = node.parent; up !== null; up = up.parent) {
      if (ids.has(up.id)) {
        return true;
      }
    }

    return false;
  }
}

export const PROPERTY_MARKS = new InjectionToken<PropertyMarks>("PropertyMarks");
