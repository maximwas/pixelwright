import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { REFERENCES } from "@/plugin/adapters/figma/layer-read/references.ts";
import { LAYER_REFS } from "@/plugin/adapters/figma/layer-refs.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * One group of a layer's fields (Strategy, A§9.4): those Figma gives, its defaults left out, boxes from `origin`. A
 * group that must ask Figma (a main component, a destination's name, a collection) answers a promise.
 */
export interface FieldReader {
  /** `root`: whether the layer is the read's root, of which some fields say more (its inherited modes). */
  read(node: SceneNode, origin: Vector, root: boolean): Partial<ReadLayer> | Promise<Partial<ReadLayer>>;
  /** A read begins: a reader that keeps what one read shares (the file's annotation categories) forgets it. */
  start?(): void;
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
  readonly #references;
  readonly #refs;

  constructor(
    readers = inject(FIELD_READERS, { multi: true }),
    format = inject(NUMBER_FORMAT),
    references = inject(REFERENCES),
    refs = inject(LAYER_REFS),
  ) {
    this.#readers = readers;
    this.#format = format;
    this.#references = references;
    this.#refs = refs;
  }

  /** A read begins: the field readers and the references forget what the last read kept. */
  start(): void {
    for (const reader of this.#readers) {
      reader.start?.();
    }

    this.#references.start();
  }

  /** The layer's own entry, its children left out: ReadRun lists them. */
  async entry(node: SceneNode, root: SceneNode): Promise<ReadLayer> {
    const origin = this.#translation(root);
    const fields: Partial<ReadLayer> = {};

    if (node.visible) {
      // In order, one after another: the model keeps the readers' field order (m:f53dbe49).
      for (const reader of this.#readers) {
        Object.assign(fields, await reader.read(node, origin, node === root));
      }
    }

    return { ...this.#header(node, origin), ...fields, childCount: this.children(node).length };
  }

  /**
   * What a read's model holds beside its root: the file's colour profile (LEGACY, SRGB, DISPLAY_P3: a Display P3 file's
   * channels are P3 values, K-064), the Dev Mode status of the root or the nearest layer above it (C-134), and the
   * styles and variables the read uses (T-163), and the page's Dev Mode measurements with a side on the read's layers
   * (T-061). `node` is the root's layer.
   */
  async tables(root: ReadLayer,    node: SceneNode): Promise<Pick<ReadModel, "colorProfile" | "devStatus" | "styles" | "variables" | "measurements">> {
    return {
      colorProfile: figma.root.documentColorProfile,
      ...this.#devStatus(node),
      ...(await this.#references.tables(root, node)),
      ...this.#measurements(node),
    };
  }

  /** The page's measurements with an end on the root or inside it; none where Figma refuses them (Dev Mode only). */
  #measurements(node: SceneNode): Pick<ReadModel, "measurements"> {
    let page: BaseNode | null = node;

    while (page !== null && page.type !== FIGMA_NODE_TYPE.page) {
      page = page.parent;
    }

    const owner: (PageNode & Partial<MeasurementsMixin>) | null = page?.type === FIGMA_NODE_TYPE.page ? page : null;
    let measurements: Measurement[];

    try {
      measurements = owner?.getMeasurements?.() ?? [];
    } catch {
      return {};
    }

    const within = (end: BaseNode) => {
      for (let current: BaseNode | null = end; current !== null; current = current.parent) {
        if (current.id === node.id) {
          return true;
        }
      }

      return false;
    };
    const read = measurements
      .filter(({ start, end }) => within(start.node) || within(end.node))
      .map(({ start, end, freeText }) => ({
        start: { id: start.node.id, side: start.side },
        end: { id: end.node.id, side: end.side },
        ...(freeText === "" ? {} : { text: freeText }),
      }));

    return read.length === 0 ? {} : { measurements: read };
  }

  /** Figma marks frames and sections: the status of the layer or of the nearest one above it that has one. */
  #devStatus(node: SceneNode): Pick<ReadModel, "devStatus"> {
    for (let current: BaseNode | null = node; current !== null; current = current.parent) {
      const devStatus = this.#refs.devStatus(current);

      if (devStatus !== undefined) {
        return { devStatus };
      }
    }

    return {};
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
