import { MIXED, type OperationInput, roundTo, type SnapshotNode } from "@pixelwright/core";
import type { InstanceOverrides } from "../../figma/instance-overrides.ts";
import { plain } from "../../utils/plain.ts";
import type { References } from "./references.ts";

/** How a read reads each layer: where its boxes start, what it asks Figma for, what it collects on the way. */
export interface EntryContext {
  readonly x: number;
  readonly y: number;
  readonly css: OperationInput<"snapshot">["css"];
  /** Hash each vector's paths: only a comparison of drawings needs it. */
  readonly paths?: boolean;
  readonly references: References;
  /** Annotation category names by id. */
  readonly categories: ReadonlyMap<string, string>;
  /** A hidden layer read whole, not as a name and a box: design_apply changes it. */
  readonly whole?: boolean;
  /** What the read's instances (and those above it) override, by layer: an instance is recorded before its layers. */
  readonly overrides?: InstanceOverrides;
  /** Ask Figma which variable a raw value matches: a read wants it for its hints; design_apply's own read does not. */
  readonly inferred?: boolean;
}

/** A box from the read's origin, as entries give boxes. */
export function boxFrom(rect: Rect, context: EntryContext): { x: number; y: number; width: number; height: number } {
  return {
    x: roundTo(rect.x - context.x, 2),
    y: roundTo(rect.y - context.y, 2),
    width: roundTo(rect.width, 2),
    height: roundTo(rect.height, 2),
  };
}

/** One layer's entry as a snapshot carries it, built field by field: Figma's raw values, figma.mixed as core writes it. */
export class LayerEntry {
  readonly node: SceneNode;
  /** The layer's fields by name, for the readers that go through lists of them. */
  readonly layer: SceneNode & Record<string, unknown>;
  readonly context: EntryContext;
  /** What the entry holds so far: the snapshot's fields and any other field the readers name. */
  readonly #fields: Partial<SnapshotNode> & Record<string, unknown>;

  constructor(node: SceneNode, context: EntryContext) {
    const [[, , x], [, , y]] = node.absoluteTransform;

    this.node = node;
    this.layer = node as SceneNode & Record<string, unknown>;
    this.context = context;
    this.#fields = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
      x: roundTo((x ?? 0) - context.x, 2),
      y: roundTo((y ?? 0) - context.y, 2),
      width: roundTo(node.width, 2),
      height: roundTo(node.height, 2),
    };
  }

  /** A field Figma gave, unless it is missing or the value core takes when it is left out. */
  put(key: string, value: unknown, omitted?: unknown): void {
    if (value !== undefined && value !== null && value !== omitted) {
      this.#fields[key] = value === figma.mixed ? MIXED : value;
    }
  }

  /** Each of these fields of the layer, as put takes them. */
  putAll(keys: readonly string[]): void {
    for (const key of keys) {
      this.put(key, this.layer[key]);
    }
  }

  /** A field as the reader made it. */
  set(key: string, value: unknown): void {
    this.#fields[key] = value;
  }

  /** A list of paints or effects: mixed, or the list when it holds any. */
  paints(key: string, value: unknown): void {
    if (value === figma.mixed) {
      this.#fields[key] = MIXED;
    } else if (Array.isArray(value) && value.length > 0) {
      this.#fields[key] = plain(value);
    }
  }

  get(key: string): unknown {
    return this.#fields[key];
  }

  /** The fields so far, for the readers that look at several. */
  fields(): Readonly<Record<string, unknown>> {
    return this.#fields;
  }

  /** The entry as it goes on the wire: the server checks it against SnapshotSchema; here it is raw Plugin API data. */
  snapshot(): SnapshotNode {
    return this.#fields as SnapshotNode;
  }
}
