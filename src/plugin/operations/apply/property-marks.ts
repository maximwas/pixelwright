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
  /** The kinds this call's layers asked for each name, per owner (a stand-in itself, a node by its id). */
  readonly #claims = new Map<unknown, Map<string, Set<string>>>();
  readonly #variants;
  readonly #assign;

  constructor(variants = inject(VARIANTS), assign = inject(ASSIGN)) {
    this.#variants = variants;
    this.#assign = assign;
  }

  start(): void {
    this.#marks.splice(0);
    this.#claims.clear();
  }

  /**
   * What binding refuses, found without writing: the kind of layer each name goes on, what holds the layer (a new one's
   * parent chain runs through the stand-ins a dry run keeps), the properties it has by those names and the kinds the
   * layers this call claimed before it asked them (a component the call makes has no properties yet).
   */
  check(layer: TypedLayer, property: Property): void {
    const wanted = this.#wanted(layer.type, property);
    const owner = this.#variants.owner(this.#holder(layer.parent) as ComponentNode);
    const claimed = this.#claims.get(this.#key(owner));

    for (const one of wanted) {
      if ("id" in owner) {
        this.#keyFor(owner, one);
      }

      const other = [...(claimed?.get(one.name) ?? [])].find((type) => type !== one.type);

      if (other !== undefined) {
        throw this.#otherKind(owner, other, one.name);
      }
    }
  }

  /**
   * The names a layer asks, kept once it passed `check`: a dry run adds no property, so what a second layer of the
   * call asks is held against these. One layer's own names never clash, they are claimed after both of its checks.
   */
  claim(layer: TypedLayer, property: Property): void {
    const owner = this.#variants.owner(this.#holder(layer.parent) as ComponentNode);
    const claimed = this.#claims.get(this.#key(owner)) ?? new Map<string, Set<string>>();

    for (const { name, type } of this.#wanted(layer.type, property)) {
      claimed.set(name, (claimed.get(name) ?? new Set<string>()).add(type));
    }

    this.#claims.set(this.#key(owner), claimed);
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
      throw this.#otherKind(owner, definitions[other]?.type ?? "", name);
    }

    return named[0];
  }

  /** The refusal of a name the owner has, or a layer of the call asked, as another kind. */
  #otherKind(
    owner: TypedLayer,
    type: string,
    name: string,
  ): WriteError {
    return new WriteError(
      APPLY_TEXT.otherKind(owner.name ?? CAPABILITY_TEXT.type(owner.type), CAPABILITY_TEXT.type(type), name),
      APPLY_TEXT.otherKindHint,
    );
  }

  /** What names an owner among the call's claims: a node by its id, a stand-in (no id, no copy of it) itself. */
  #key(owner: TypedLayer): unknown {
    return "id" in owner ? owner.id : owner;
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
