import { groupBy } from "es-toolkit";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import type { Both, Placed, PlacedPair, Side } from "@/core/diff/baseline/baseline.types.ts";
import { DIFF_TEXT } from "@/core/diff/diff.constants.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";

/**
 * The layers of a baseline and of the design now, paired (K-055): the roots; every id both hold; then, top down under
 * each pair of parents, the children left on both sides, first by tag and name in order, then by name alone (a
 * detached instance). Nothing under a parent whose children a read's budget cut, on either side, is paired or listed.
 */
export class LayerPairs {
  readonly before: Side;
  readonly after: Side;
  readonly #toAfter = new Map<string, string>();
  readonly #toBefore = new Map<string, string>();
  readonly #excludedBefore = new Set<string>();
  readonly #excludedAfter = new Set<string>();

  constructor(before: Side, after: Side) {
    this.before = before;
    this.after = after;
    this.#excludeCuts();

    const [beforeRoot] = before.values();
    const [afterRoot] = after.values();

    if (beforeRoot !== undefined && afterRoot !== undefined) {
      this.#pair(beforeRoot.element.id, afterRoot.element.id);
    }

    for (const id of after.keys()) {
      if (before.has(id) && !this.#isTaken(id, id)) {
        this.#pair(id, id);
      }
    }

    for (const placed of after.values()) {
      this.#pairChildren(placed);
    }
  }

  /** The baseline's id paired with this layer of now; undefined when it has none. */
  beforeOf(afterId: string): string | undefined {
    return this.#toBefore.get(afterId);
  }

  afterOf(beforeId: string): string | undefined {
    return this.#toAfter.get(beforeId);
  }

  /** The pairs, in the design's order now: [before, now]. */
  pairs(): PlacedPair[] {
    return [...this.after.values()].flatMap((now) => {
      const before = this.before.get(this.#toBefore.get(now.element.id) ?? "");

      return before === undefined ? [] : [[before, now] as const];
    });
  }

  /** The layers under a cut on either side, by side: nothing in them is paired, and their tokens are left out. */
  excluded(): Both<ReadonlySet<string>> {
    return { before: this.#excludedBefore, after: this.#excludedAfter };
  }

  /** The layers of now without a pair, under no cut, in document order. */
  unpairedAfter(): Placed[] {
    return [...this.after.values()].filter(
      ({ element }) => !this.#toBefore.has(element.id) && !this.#excludedAfter.has(element.id),
    );
  }

  /** The baseline's layers without a pair, under no cut, in the baseline's order. */
  unpairedBefore(): Placed[] {
    return [...this.before.values()].filter(
      ({ element }) => !this.#toAfter.has(element.id) && !this.#excludedBefore.has(element.id),
    );
  }

  /** Whether a read's budget cut some or all of a layer's children: `$children` marks it (m:ec973ea3). */
  cut(element: XmlElement): boolean {
    return element.attributes.some(([name]) => name === DESIGN_ATTRIBUTE.children);
  }

  #excludeCuts(): void {
    const cut = new Set(
      [...this.before.values(), ...this.after.values()]
        .filter(({ element }) => this.cut(element))
        .map(({ element }) => element.id),
    );

    this.#excludeUnder(this.before, cut, this.#excludedBefore);
    this.#excludeUnder(this.after, cut, this.#excludedAfter);
  }

  /** A pair's children left on both sides, paired by tag and name, then by name alone. */
  #pairChildren(now: Placed): void {
    const before = this.before.get(this.#toBefore.get(now.element.id) ?? "");

    if (before === undefined || this.cut(before.element) || this.cut(now.element)) {
      return;
    }

    const left = before.element.children.filter((child) => !this.#isTaken(child.id, null));
    const right = now.element.children.filter((child) => !this.#isTaken(null, child.id));

    this.#pairBy(
      left,
      right,
      (element) => DIFF_TEXT.key(element.tag, this.#nameIn(this.before, element)),
      (element) => DIFF_TEXT.key(element.tag, this.#nameIn(this.after, element)),
    );
    this.#pairBy(
      left.filter((child) => !this.#toAfter.has(child.id)),
      right.filter((child) => !this.#toBefore.has(child.id)),
      (element) => this.#nameIn(this.before, element),
      (element) => this.#nameIn(this.after, element),
    );
  }

  /** Two lists paired in order by a key: the first of each key with the first on the other side, and so on. */
  #pairBy(
    left: readonly XmlElement[],
    right: readonly XmlElement[],
    leftKey: (element: XmlElement) => string,
    rightKey: (element: XmlElement) => string,
  ): void {
    const waiting = groupBy(left, leftKey);

    for (const element of right) {
      const match = waiting[rightKey(element)]?.shift();

      if (match !== undefined) {
        this.#pair(match.id, element.id);
      }
    }
  }

  #nameIn(side: Side, element: XmlElement): string {
    return side.get(element.id)?.name ?? "";
  }

  /** Whether a layer of either side is paired already or under a cut. */
  #isTaken(beforeId: string | null, afterId: string | null): boolean {
    return (
      (beforeId !== null && (this.#toAfter.has(beforeId) || this.#excludedBefore.has(beforeId))) ||
      (afterId !== null && (this.#toBefore.has(afterId) || this.#excludedAfter.has(afterId)))
    );
  }

  #pair(beforeId: string, afterId: string): void {
    this.#toAfter.set(beforeId, afterId);
    this.#toBefore.set(afterId, beforeId);

    const before = this.before.get(beforeId);
    const after = this.after.get(afterId);

    // A pair whose children were cut on one side: nothing under either side is paired or listed.
    if (before !== undefined && after !== undefined && (this.cut(before.element) || this.cut(after.element))) {
      this.#excludeDescendants(before.element, this.#excludedBefore);
      this.#excludeDescendants(after.element, this.#excludedAfter);
    }
  }

  /** The descendants of every layer of one side whose id is cut on either side. */
  #excludeUnder(
    side: Side,
    cut: ReadonlySet<string>,
    excluded: Set<string>,
  ): void {
    for (const { element } of side.values()) {
      if (cut.has(element.id)) {
        this.#excludeDescendants(element, excluded);
      }
    }
  }

  #excludeDescendants(element: XmlElement, excluded: Set<string>): void {
    for (const child of element.children) {
      excluded.add(child.id);
      this.#excludeDescendants(child, excluded);
    }
  }
}
