import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** One group of a layer's fields (Strategy, A§9.4): those Figma gives, its defaults left out, boxes from `origin`. */
export interface FieldReader {
  read(node: SceneNode, origin: Vector): Partial<ReadLayer>;
}

/** The fields every entry has, a hidden layer's stub too (D-18): what the layer is, and its box from the read's root. */
type Header = Pick<ReadLayer, "id" | "name" | "type" | "visible" | "x" | "y" | "width" | "height">;

/**
 * A layer as the read model holds it (Registry over the field readers, run in 0.7.0's order, m:f53dbe49): its header,
 * each group's fields, its child count; a hidden layer is its header and child count (D-18). Boxes are relative to the
 * read's root, to 0.7.0's 2 decimals.
 */
@injectable()
export class LayerReader {
  readonly #readers;
  readonly #format;

  constructor(readers = inject(FIELD_READERS, { multi: true }), format = inject(NUMBER_FORMAT)) {
    this.#readers = readers;
    this.#format = format;
  }

  /** The layer's own entry, its children left out: ReadRun lists them. */
  entry(node: SceneNode, root: SceneNode): ReadLayer {
    const origin = this.#translation(root);
    const fields: Partial<ReadLayer> = {};

    if (node.visible) {
      for (const reader of this.#readers) {
        Object.assign(fields, reader.read(node, origin));
      }
    }

    return { ...this.#header(node, origin), ...fields, childCount: this.children(node).length };
  }

  children(node: SceneNode): readonly SceneNode[] {
    return "children" in node ? node.children : [];
  }

  #header(node: SceneNode, origin: Vector): Header {
    const { x, y } = this.#translation(node);

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
      x: this.#round(x - origin.x),
      y: this.#round(y - origin.y),
      width: this.#round(node.width),
      height: this.#round(node.height),
    };
  }

  /** Where a layer sits on the canvas: absoluteTransform's translation, which a rotated layer's own x and y are not. */
  #translation(node: SceneNode): Vector {
    const [[, , x], [, , y]] = node.absoluteTransform;

    return { x, y };
  }

  #round(value: number): number {
    return this.#format.round(value, PRECISION.layer);
  }
}

export const LAYER_READER = new InjectionToken<LayerReader>("LayerReader");

/** The field readers in 0.7.0's order (m:f53dbe49), so the model's fields keep the goldens' order. */
export const FIELD_READERS = new InjectionToken<FieldReader>("FieldReaders");
