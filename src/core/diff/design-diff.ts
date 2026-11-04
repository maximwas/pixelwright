import { InjectionToken, inject, injectable } from "@needle-di/core";
import { groupBy } from "es-toolkit";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import { LAYER_TREE } from "@/core/design/tree/layer-tree.ts";
import { DIFF, DIFF_TEXT, DRAWN_TAGS, ROOT_PLACEMENT } from "@/core/diff/diff.constants.ts";
import type { DiffChange, LayersDiff, OnlyIn } from "@/core/diff/diff.schema.ts";
import { FINGERPRINT } from "@/core/diff/fingerprint.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { ReadLayers } from "@/shared/read-model/read-layers.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer as a diff compares it, or a run of a text's (a span, with no id): its layers or runs are its children. */
interface Compared {
  readonly id: string;
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** A text's characters outside its spans; null when it has none. */
  readonly text: string | null;
  readonly children: readonly Compared[];
}

/** One comparison's two reads by layer id, and the lists it fills. */
interface Walk {
  readonly a: ReadonlyMap<string, ReadLayer>;
  readonly b: ReadonlyMap<string, ReadLayer>;
  readonly onlyInA: OnlyIn[];
  readonly onlyInB: OnlyIn[];
  readonly changed: DiffChange[];
}

/**
 * How layer B differs from layer A as design_read reads them (T-085, K-051): each read built as design_read's tree,
 * layers matched by their path of tags and names below the roots (same-named siblings in order), attributes and text
 * compared, ids and the roots' own names and places left out; an icon's or image's drawing compared through what its
 * read holds of it (Fingerprint).
 */
@injectable()
export class DesignDiff {
  readonly #readLayers = new ReadLayers();
  readonly #placement: ReadonlySet<string> = new Set(ROOT_PLACEMENT);
  readonly #drawn: ReadonlySet<string> = new Set(DRAWN_TAGS);
  readonly #tree;
  readonly #fingerprint;

  constructor(tree = inject(LAYER_TREE), fingerprint = inject(FINGERPRINT)) {
    this.#tree = tree;
    this.#fingerprint = fingerprint;
  }

  diff(first: ReadModel, second: ReadModel): LayersDiff {
    const walk: Walk = { a: this.#layers(first), b: this.#layers(second), onlyInA: [], onlyInB: [], changed: [] };

    this.#compare(this.#root(first), this.#root(second), null, walk);

    const { onlyInA, onlyInB, changed } = walk;

    return { same: onlyInA.length === 0 && onlyInB.length === 0 && changed.length === 0, onlyInA, onlyInB, changed };
  }

  /** Two matched elements and, below them, their children; the path is null at the roots. */
  #compare(
    x: Compared,
    y: Compared,
    path: string | null,
    walk: Walk,
  ): void {
    const attributes = this.#changedAttributes(x, y, path === null);
    const drawing = this.#drawn.has(x.tag) && !this.#fingerprint.same(walk.a.get(x.id), walk.b.get(y.id));

    if (Object.keys(attributes).length > 0 || drawing) {
      walk.changed.push({ path: path ?? DIFF.root, a: x.id, b: y.id, attributes, ...(drawing ? { drawing } : {}) });
    }

    this.#compareChildren(x, y, path, walk);
  }

  /** The attributes and the text that differ, as [A, B]; ids, and a root's own name and place, aside. */
  #changedAttributes(
    x: Compared,
    y: Compared,
    root: boolean,
  ): DiffChange["attributes"] {
    const attributes: DiffChange["attributes"] = {};

    for (const key of new Set([...Object.keys(x.attributes), ...Object.keys(y.attributes)])) {
      const left = x.attributes[key] ?? null;
      const right = y.attributes[key] ?? null;

      if (left !== right && key !== DESIGN_ATTRIBUTE.id && !(root && this.#placement.has(key))) {
        attributes[key] = [left, right];
      }
    }

    if (x.text !== y.text) {
      attributes[DIFF.text] = [x.text, y.text];
    }

    return attributes;
  }

  /** Children matched by tag and name, in order; the ones past the other side's count are only on one side. */
  #compareChildren(
    x: Compared,
    y: Compared,
    path: string | null,
    walk: Walk,
  ): void {
    const left = this.#keyed(x);
    const right = this.#keyed(y);

    for (const [key, elements] of Object.entries(left)) {
      const others = right[key] ?? [];

      for (const [index, element] of elements.entries()) {
        const other = others[index];
        const at = this.#path(path, element, index);

        if (other === undefined) {
          walk.onlyInA.push({ path: at, id: element.id });
        } else {
          this.#compare(element, other, at, walk);
        }
      }
    }

    for (const [key, elements] of Object.entries(right)) {
      const count = left[key]?.length ?? 0;

      for (const [index, element] of elements.slice(count).entries()) {
        walk.onlyInB.push({ path: this.#path(path, element, count + index), id: element.id });
      }
    }
  }

  /** Children by tag and name, each list in document order. */
  #keyed(element: Compared): Record<string, Compared[]> {
    return groupBy(element.children, (child) => DIFF_TEXT.key(child.tag, this.#name(child)));
  }

  #path(
    parent: string | null,
    element: Compared,
    index: number,
  ): string {
    const label = DIFF_TEXT.label(element.tag, this.#name(element), index);

    return parent === null ? label : [parent, label].join(DIFF.joiner);
  }

  #name(element: Compared): string {
    return element.attributes[DESIGN_ATTRIBUTE.name] ?? "";
  }

  #root(model: ReadModel): Compared {
    const root = this.#tree.root(model);

    if (root === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DIFF_TEXT.noElement(model.root.id));
    }

    return this.#compared(root);
  }

  /** An element as a diff compares it: a text's spans become its children, in order. */
  #compared(element: XmlElement): Compared {
    const content = element.content ?? [];
    const texts = content.flatMap((piece) =>
      piece.kind === XML_CONTENT.text && piece.value !== "" ? [piece.value] : [],
    );
    const spans = content.flatMap((piece) =>
      piece.kind === XML_CONTENT.span
        ? [
          {
            id: "",
            tag: DIFF.span,
            attributes: Object.fromEntries(piece.attributes),
            text: piece.value === "" ? null : piece.value,
            children: [],
          },
        ]
        : [],
    );

    return {
      id: element.id,
      tag: element.tag,
      attributes: Object.fromEntries(element.attributes),
      text: texts.length === 0 ? null : texts.join(""),
      children: [...element.children.map((child) => this.#compared(child)), ...spans],
    };
  }

  #layers(model: ReadModel): Map<string, ReadLayer> {
    return new Map([...this.#readLayers.walk(model.root)].map(({ layer }) => [layer.id, layer]));
  }
}

export const DESIGN_DIFF = new InjectionToken<DesignDiff>("DesignDiff");
