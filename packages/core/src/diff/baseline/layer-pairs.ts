import type { DesignElement } from "../../design/tree.ts";

/** How long a label's name may be before it is cut. */
const LABEL_NAME_CHARS = 40;

/** A layer of one side: design_read's element, its parent, where it is (as a path of labels) and in what order. */
export interface Placed {
  readonly element: DesignElement;
  readonly parent: string | null;
  /** The layer's Figma name. */
  readonly name: string;
  readonly label: string;
  /** The labels below the root joined by " / "; the root is "(root)". */
  readonly path: string;
  /** Its place in document order. */
  readonly order: number;
}

/** One side's layers by id, in document order. */
export type Side = ReadonlyMap<string, Placed>;

/** A layer's label: its tag and its Figma name, cut short. */
export function labelOf(tag: string, name: string): string {
  return `${tag} "${name.slice(0, LABEL_NAME_CHARS)}"`;
}

/** Every element of a tree by id, with its parent, label and path; names come from the snapshot's layers. */
export function placedLayers(root: DesignElement, nameOf: (id: string) => string): Side {
  const placed = new Map<string, Placed>();
  const visit = (element: DesignElement, parent: Placed | null) => {
    const name = nameOf(element.id);
    const label = labelOf(element.tag, name);
    const entry: Placed = {
      element,
      parent: parent?.element.id ?? null,
      name,
      label,
      path: parent === null ? "(root)" : parent.parent === null ? label : `${parent.path} / ${label}`,
      order: placed.size,
    };

    placed.set(element.id, entry);

    for (const child of element.children) {
      visit(child, entry);
    }
  };

  visit(root, null);

  return placed;
}

/** Whether a layer's children were cut by the snapshot's budget (some or all of them): $children marks it. */
export function isCut(element: DesignElement): boolean {
  return element.attributes.some(([name]) => name === "$children");
}

/**
 * The layers of a baseline and of the design now, paired: the roots; every id both hold; then, top down under each pair
 * of parents, the children left on both sides, first by tag and name in order, then by name alone (a detached instance).
 * Nothing under a parent whose children were cut, on either side, is paired.
 */
export class LayerPairs {
  readonly before: Side;
  readonly after: Side;
  readonly #toAfter = new Map<string, string>();
  readonly #toBefore = new Map<string, string>();
  readonly #excluded = {
    before: new Set<string>(),
    after: new Set<string>(),
  };

  constructor(before: Side, after: Side) {
    this.before = before;
    this.after = after;
    this.#excludeCuts();

    const [beforeRoot] = before.values();
    const [afterRoot] = after.values();

    if (beforeRoot !== undefined && afterRoot !== undefined) {
      this.#pair(beforeRoot.element.id, afterRoot.element.id);
    }

    this.#pairIds();

    for (const placed of after.values()) {
      this.#pairChildren(placed);
    }
  }

  /** The before side's id paired with this layer of now; undefined when it has none. */
  beforeOf(afterId: string): string | undefined {
    return this.#toBefore.get(afterId);
  }

  afterOf(beforeId: string): string | undefined {
    return this.#toAfter.get(beforeId);
  }

  /** The pairs, in the design's order now: [before, now]. */
  pairs(): [Placed, Placed][] {
    return [...this.after.values()].flatMap((now) => {
      const before = this.before.get(this.#toBefore.get(now.element.id) ?? "");

      return before === undefined ? [] : [[before, now] as [Placed, Placed]];
    });
  }

  /** The layers of one side under a parent whose children were cut on either side: they are not compared. */
  excluded(side: "before" | "after"): ReadonlySet<string> {
    return this.#excluded[side];
  }

  /** The layers of now without a pair, under no cut, in document order. */
  unpairedAfter(): Placed[] {
    return [...this.after.values()].filter(
      ({ element }) => !this.#toBefore.has(element.id) && !this.#excluded.after.has(element.id),
    );
  }

  /** The baseline's layers without a pair, under no cut, in the baseline's order. */
  unpairedBefore(): Placed[] {
    return [...this.before.values()].filter(
      ({ element }) => !this.#toAfter.has(element.id) && !this.#excluded.before.has(element.id),
    );
  }

  /** Nothing under a parent whose children were cut on either side is paired or listed. */
  #excludeCuts(): void {
    const cut = new Set(
      [...this.before.values(), ...this.after.values()]
        .filter(({ element }) => isCut(element))
        .map(({ element }) => element.id),
    );

    excludeUnder(this.before, cut, this.#excluded.before);
    excludeUnder(this.after, cut, this.#excluded.after);
  }

  #pairIds(): void {
    for (const id of this.after.keys()) {
      if (this.before.has(id) && !this.#isTaken(id, id)) {
        this.#pair(id, id);
      }
    }
  }

  /** A pair's children left on both sides, paired by tag and name, then by name alone. */
  #pairChildren(now: Placed): void {
    const beforeId = this.#toBefore.get(now.element.id);
    const before = beforeId === undefined ? undefined : this.before.get(beforeId);

    if (before === undefined || isCut(before.element) || isCut(now.element)) {
      return;
    }

    const left = before.element.children.filter((child) => !this.#isTaken(child.id, null));
    const right = now.element.children.filter((child) => !this.#isTaken(null, child.id));

    this.#pairBy(
      left,
      right,
      (element) => `${element.tag} ${this.#nameIn(this.before, element)}`,
      (element) => `${element.tag} ${this.#nameIn(this.after, element)}`,
    );
    this.#pairBy(
      left.filter((child) => !this.#toAfter.has(child.id)),
      right.filter((child) => !this.#toBefore.has(child.id)),
      (element) => this.#nameIn(this.before, element),
      (element) => this.#nameIn(this.after, element),
    );
  }

  /** Pairs two lists in order by a key: the first of each key with the first on the other side, and so on. */
  #pairBy(
    left: readonly DesignElement[],
    right: readonly DesignElement[],
    leftKey: (element: DesignElement) => string,
    rightKey: (element: DesignElement) => string,
  ): void {
    const waiting = new Map<string, DesignElement[]>();

    for (const element of left) {
      waiting.set(leftKey(element), [...(waiting.get(leftKey(element)) ?? []), element]);
    }

    for (const element of right) {
      const match = waiting.get(rightKey(element))?.shift();

      if (match !== undefined) {
        this.#pair(match.id, element.id);
      }
    }
  }

  #nameIn(side: Side, element: DesignElement): string {
    return side.get(element.id)?.name ?? "";
  }

  /** Whether a layer of either side is paired already or under a cut. */
  #isTaken(beforeId: string | null, afterId: string | null): boolean {
    return (
      (beforeId !== null && (this.#toAfter.has(beforeId) || this.#excluded.before.has(beforeId))) ||
      (afterId !== null && (this.#toBefore.has(afterId) || this.#excluded.after.has(afterId)))
    );
  }

  #pair(beforeId: string, afterId: string): void {
    this.#toAfter.set(beforeId, afterId);
    this.#toBefore.set(afterId, beforeId);

    const before = this.before.get(beforeId);
    const after = this.after.get(afterId);

    // A pair whose children were cut on one side: nothing under either side is paired or listed.
    if (before !== undefined && after !== undefined && (isCut(before.element) || isCut(after.element))) {
      excludeDescendants(before.element, this.#excluded.before);
      excludeDescendants(after.element, this.#excluded.after);
    }
  }
}

/** The descendants of every layer of one side whose id is cut on either side. */
function excludeUnder(side: Side, cut: ReadonlySet<string>, excluded: Set<string>): void {
  for (const { element } of side.values()) {
    if (cut.has(element.id)) {
      excludeDescendants(element, excluded);
    }
  }
}

function excludeDescendants(element: DesignElement, excluded: Set<string>): void {
  for (const child of element.children) {
    excluded.add(child.id);
    excludeDescendants(child, excluded);
  }
}
