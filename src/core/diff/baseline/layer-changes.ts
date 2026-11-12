import { InjectionToken, inject, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";
import { CSS_URL } from "@/core/css/values/css-url.ts";
import {
  BASELINE_CHANGE,
  BASELINE_ROOT_PLACEMENT,
  LEFT_OUT,
  LISTED,
  NOT_COMPARED,
} from "@/core/diff/baseline/baseline.constants.ts";
import type { BaselineChanges, Pair } from "@/core/diff/baseline/baseline.schema.ts";
import type { PairSources, Placed } from "@/core/diff/baseline/baseline.types.ts";
import type { LayerPairs } from "@/core/diff/baseline/layer-pairs.ts";
import { DIFF, DRAWN_TAGS } from "@/core/diff/diff.constants.ts";
import { FINGERPRINT } from "@/core/diff/fingerprint.ts";
import { NAME_VALUE_LIST } from "@/core/kernel/lists/name-value-list.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { XML_WRITER } from "@/core/xml/xml-writer.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Changed = BaselineChanges["changed"][number];

/** The pairs' changes, and the drawings a side did not hold whole. */
interface PairChanges {
  readonly changed: Changed[];
  readonly notCompared: BaselineChanges["notCompared"];
}

/** How one pair is compared: what both sides read, whether its drawing can be, whether its parent was made again. */
interface PairCheck {
  readonly sources: PairSources;
  readonly drawingChecked: boolean;
  readonly parentRemade: boolean;
}

/**
 * How each pair of layers differs as design_read writes them (T-205, K-055): attributes as [before, now], with ids,
 * planned file paths and a cut's marks aside, url() paths emptied (design_read numbers asset files in document order),
 * the root's place aside and props and variant reduced to the pairs that differ; the tag as $tag, a text's content as
 * its XML in $text, the root's page as $page; drawn anew by what draws an icon or image (Fingerprint) or another image
 * in a layer's fills. A layer made again (another id) is a change of its own, but only the topmost.
 */
@injectable()
export class LayerChanges {
  readonly #leftOut: ReadonlySet<string> = new Set(LEFT_OUT);
  readonly #placement: ReadonlySet<string> = new Set(BASELINE_ROOT_PLACEMENT);
  readonly #listed: ReadonlySet<string> = new Set(LISTED);
  readonly #drawn: ReadonlySet<string> = new Set(DRAWN_TAGS);
  readonly #fingerprint;
  readonly #urls;
  readonly #list;
  readonly #writer;

  constructor(
    fingerprint = inject(FINGERPRINT),
    urls = inject(CSS_URL),
    list = inject(NAME_VALUE_LIST),
    writer = inject(XML_WRITER),
  ) {
    this.#fingerprint = fingerprint;
    this.#urls = urls;
    this.#list = list;
    this.#writer = writer;
  }

  /** Each pair's change; an icon or image a side's read did not hold whole is not compared by its drawing. */
  of(pairs: LayerPairs, sources: PairSources): PairChanges {
    const changed: Changed[] = [];
    const notCompared: BaselineChanges["notCompared"] = [];

    for (const [before, now] of pairs.pairs()) {
      const unchecked =
        this.#drawn.has(now.element.tag) &&
        (this.#incomplete(sources.before.get(before.element.id)) ||
          this.#incomplete(sources.after.get(now.element.id)));
      const parentRemade = now.parent !== null && pairs.beforeOf(now.parent) !== now.parent;
      const change = this.#change(before, now, { sources, drawingChecked: !unchecked, parentRemade });

      if (unchecked) {
        notCompared.push({ path: now.path, id: now.element.id, what: NOT_COMPARED.drawing });
      }

      if (change !== null) {
        changed.push(change);
      }
    }

    return { changed, notCompared };
  }

  /** A pair's change; null when nothing changed and it kept its id, or its parent was made again. */
  #change(
    before: Placed,
    now: Placed,
    check: PairCheck,
  ): Changed | null {
    const root = now.parent === null;
    const attributes = this.#attributes(before.element, now.element, root);
    const drawing =
      check.drawingChecked && this.#drawnAnew(before.element.id, now.element.id, now.element.tag, check.sources);
    const remade = before.element.id !== now.element.id;

    if (root) {
      Object.assign(attributes, this.#page(check.sources.pages));
    }

    // A layer made again (another id) is a change of its own: code that names the old id must follow.
    if (Object.keys(attributes).length === 0 && !drawing && (!remade || check.parentRemade)) {
      return null;
    }

    return {
      path: now.path,
      id: now.element.id,
      ...(remade ? { was: before.element.id } : {}),
      tag: now.element.tag,
      attributes,
      ...(drawing ? { drawing: true as const } : {}),
    };
  }

  #attributes(
    before: XmlElement,
    after: XmlElement,
    root: boolean,
  ): Record<string, Pair> {
    const left: Record<string, string> = Object.fromEntries(before.attributes);
    const right: Record<string, string> = Object.fromEntries(after.attributes);
    const changed: Record<string, Pair> = {};

    if (before.tag !== after.tag) {
      changed[BASELINE_CHANGE.tag] = [before.tag, after.tag];
    }

    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const skipped = this.#leftOut.has(key) || (root && this.#placement.has(key));
      const pair = skipped ? null : this.#compared(key, left[key] ?? null, right[key] ?? null);

      if (pair !== null) {
        changed[key] = pair;
      }
    }

    const text: Pair = [this.#text(before), this.#text(after)];

    if (text[0] !== text[1]) {
      changed[DIFF.text] = text;
    }

    return changed;
  }

  #compared(
    key: string,
    before: string | null,
    after: string | null,
  ): Pair | null {
    if (before === after) {
      return null;
    }

    if (this.#listed.has(key)) {
      return this.#differingItems(before, after);
    }

    const sameButFiles =
      before !== null && after !== null && this.#urls.withoutUrls(before) === this.#urls.withoutUrls(after);

    return sameButFiles ? null : [before, after];
  }

  /** The name=value items each side holds and the other does not; null when both hold the same ones. */
  #differingItems(before: string | null, after: string | null): Pair | null {
    const left = before === null ? {} : this.#list.parse(before);
    const right = after === null ? {} : this.#list.parse(after);

    if (left === null || right === null) {
      return [before, after];
    }

    const onlyLeft = Object.fromEntries(Object.entries(left).filter(([name, value]) => right[name] !== value));
    const onlyRight = Object.fromEntries(Object.entries(right).filter(([name, value]) => left[name] !== value));

    if (Object.keys(onlyLeft).length === 0 && Object.keys(onlyRight).length === 0) {
      return null;
    }

    return [this.#items(onlyLeft), this.#items(onlyRight)];
  }

  #items(values: Record<string, string>): string | null {
    return Object.keys(values).length === 0 ? null : this.#list.write(values);
  }

  /** A text's content as its element writes it, spans included; null for any other element. */
  #text(element: XmlElement): string | null {
    return element.content === null ? null : this.#writer.content(element.content);
  }

  /** The root's page, when it moved to another one. */
  #page([before, now]: PairSources["pages"]): Record<string, Pair> {
    return before !== undefined && now !== undefined && before.id !== now.id
      ? { [BASELINE_CHANGE.page]: [before.name, now.name] }
      : {};
  }

  /**
   * Whether a pair is drawn anew: an icon's or image's drawing (over the fields both reads hold when two plugin
   * versions read them), or another image in the layer's own fills.
   */
  #drawnAnew(
    beforeId: string,
    afterId: string,
    tag: string,
    sources: PairSources,
  ): boolean {
    const before = sources.before.get(beforeId);
    const after = sources.after.get(afterId);

    if (this.#drawn.has(tag)) {
      const [left, right] = sources.sameReader ? [before, after] : this.#shared(before, after);

      if (!this.#fingerprint.same(left, right)) {
        return true;
      }
    }

    return !isEqual(this.#images(before), this.#images(after));
  }

  /** Both reads with only the fields both hold, at any depth: a field a newer plugin reads is no change. */
  #shared(before: ReadLayer | undefined, after: ReadLayer | undefined): [unknown, unknown] {
    const right = this.#keys(after, new Set());
    const both = new Set([...this.#keys(before, new Set())].filter((key) => right.has(key)));

    return [this.#kept(before, both), this.#kept(after, both)];
  }

  #keys(value: unknown, keys: Set<string>): Set<string> {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.#keys(item, keys);
      }
    } else if (typeof value === "object" && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        keys.add(key);
        this.#keys(item, keys);
      }
    }

    return keys;
  }

  #kept(value: unknown, keys: ReadonlySet<string>): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.#kept(item, keys));
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => keys.has(key))
        .map(([key, item]) => [key, this.#kept(item, keys)]),
    );
  }

  /** The images a layer's own fills hold, in order. */
  #images(layer: ReadLayer | undefined): string[] {
    const fills = layer?.fills;

    return Array.isArray(fills)
      ? fills.flatMap((paint) => (typeof paint.imageHash === "string" ? [paint.imageHash] : []))
      : [];
  }

  /** A shown layer whose read lacks some of its children, or holds one that does: the budget cut it. */
  #incomplete(layer: ReadLayer | undefined): boolean {
    if (layer === undefined || !layer.visible) {
      return false;
    }

    const children = layer.children ?? [];

    return children.length < layer.childCount || children.some((child) => this.#incomplete(child));
  }
}

export const LAYER_CHANGES = new InjectionToken<LayerChanges>("LayerChanges");
