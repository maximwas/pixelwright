import { designTree } from "../../design/design-xml.ts";
import type { DesignTree } from "../../design/tree.ts";
import type { RawTokens } from "../../tokens/raw-tokens.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { nodesOf } from "../compare/fingerprint.ts";
import { foldComponents } from "./component-changes.ts";
import { changedAttributes, type DrawingSources, drawnAnew } from "./layer-changes.ts";
import { LayerPairs, type Placed, placedLayers } from "./layer-pairs.ts";
import { withLiveNames } from "./live-names.ts";
import { cutPairs, structureChanges } from "./structure-changes.ts";
import { type TokenSide, tokenChanges } from "./token-changes.ts";
import type { BaselineChanges, Counts, Pair } from "./types.ts";

/** The most entries one list of an answer holds by default; more counts the rest. */
const LIST_CAP = 200;

/** Tags whose look is a file of its own: compared by what draws them too. */
const DRAWN: ReadonlySet<string> = new Set(["Icon", "Image"]);

/** One side of a comparison: a layer's read and the tokens it uses (null when they could not be read). */
export interface BaselineSide {
  readonly snapshot: Snapshot;
  readonly tokens: RawTokens | null;
}

export interface BaselineDiff {
  /** Nothing changed: every list of changes is empty (what was not compared is not a change). */
  readonly same: boolean;
  readonly changes: BaselineChanges;
  /** How many entries each list held before the cap. */
  readonly counts: Counts;
  /** The entries past the cap, all lists together. */
  readonly more: number;
  readonly notes: string[];
}

/**
 * What changed between a baseline and the design now, in design_read's terms: both sides rendered by today's core (the
 * baseline with the live names of the tokens both use), layers paired by id, then by tag and name; the changes of each
 * pair, the structure, a change shared by a component's instances once, and the tokens in every mode.
 */
export function baselineDiff(
  before: BaselineSide,
  after: BaselineSide,
  { sameReader, cap = LIST_CAP }: { sameReader: boolean; cap?: number },
): BaselineDiff {
  const trees = {
    before: designTree(withLiveNames(before.snapshot, after.snapshot)),
    after: designTree(after.snapshot),
  };

  if (trees.before.root === null || trees.after.root === null) {
    throw new Error("A hidden root has no element to compare: check the root before comparing.");
  }

  const nodes = {
    before: nodesOf(before.snapshot.root),
    after: nodesOf(after.snapshot.root),
  };
  const pairs = new LayerPairs(
    placedLayers(trees.before.root, nameIn(nodes.before)),
    placedLayers(trees.after.root, nameIn(nodes.after)),
  );
  const notes = profileNotes(before.snapshot, after.snapshot);
  const layers = pairChanges(pairs, {
    ...nodes,
    sameReader,
    pages: [before.snapshot.page, after.snapshot.page],
  });
  const structure = structureChanges(pairs, nodes);

  return capped(
    {
      ...foldComponents(
        {
          changed: layers.changed,
          added: structure.added,
          removed: structure.removed,
        },
        {
          pairs,
          ...nodes,
        },
      ),
      moved: structure.moved,
      reordered: structure.reordered,
      tokens: tokenChanges(tokenSide(before, trees.before), tokenSide(after, trees.after), notes),
      notCompared: [...cutPairs(pairs), ...layers.notCompared],
    },
    cap,
    notes,
  );
}

function tokenSide(side: BaselineSide, tree: DesignTree): TokenSide {
  return {
    raw: side.tokens,
    snapshot: side.snapshot,
    tree,
  };
}

/** What the comparison of each pair needs: both sides' layers, the reader, the pages the roots were on. */
interface PairSources extends DrawingSources {
  readonly pages: readonly [{ id: string; name: string } | undefined, { id: string; name: string } | undefined];
}

/** Each pair's changed attributes and new drawing; icons whose subtree a side did not hold whole are not drawn-checked. */
function pairChanges(pairs: LayerPairs, sources: PairSources): Pick<BaselineChanges, "changed" | "notCompared"> {
  const changed: BaselineChanges["changed"] = [];
  const notCompared: BaselineChanges["notCompared"] = [];

  for (const [before, now] of pairs.pairs()) {
    const unchecked =
      DRAWN.has(now.element.tag) &&
      (incomplete(sources.before.get(before.element.id)) || incomplete(sources.after.get(now.element.id)));
    const change = pairChange(before, now, {
      sources,
      drawingChecked: !unchecked,
      parentRemade: now.parent !== null && pairs.beforeOf(now.parent) !== now.parent,
    });

    if (unchecked) {
      notCompared.push(entryOf(now, "drawing"));
    }

    if (change !== null) {
      changed.push(change);
    }
  }

  return {
    changed,
    notCompared,
  };
}

/**
 * One pair's change: its attributes as [before, now] and whether it is drawn anew; null when nothing changed. A layer
 * made again (another id) is a change of its own, but only the topmost: under a parent made again every id is new.
 */
function pairChange(
  before: Placed,
  now: Placed,
  { sources, drawingChecked, parentRemade }: { sources: PairSources; drawingChecked: boolean; parentRemade: boolean },
): BaselineChanges["changed"][number] | null {
  const attributes = changedAttributes(before.element, now.element, now.parent === null);
  const drawing = drawingChecked && drawnAnew(before.element.id, now.element.id, now.element.tag, sources);

  if (now.parent === null) {
    Object.assign(attributes, pageChange(sources.pages));
  }

  // A layer made again (another id) is a change of its own: code that names the old id must follow.
  if (Object.keys(attributes).length === 0 && !drawing && (before.element.id === now.element.id || parentRemade)) {
    return null;
  }

  return {
    path: now.path,
    id: now.element.id,
    ...(before.element.id === now.element.id ? {} : { was: before.element.id }),
    tag: now.element.tag,
    attributes,
    ...(drawing ? { drawing: true as const } : {}),
  };
}

/** The root's page, when it moved to another one. */
function pageChange([before, now]: PairSources["pages"]): { $page?: Pair } {
  return before !== undefined && now !== undefined && before.id !== now.id ? { $page: [before.name, now.name] } : {};
}

function entryOf(placed: Placed, what: "drawing"): BaselineChanges["notCompared"][number] {
  return {
    path: placed.path,
    id: placed.element.id,
    what,
  };
}

/** A shown layer whose read lacks some of its children, or holds one that does: the budget cut it. */
function incomplete(node: SnapshotNode | undefined): boolean {
  if (node === undefined || !node.visible) {
    return false;
  }

  return (node.children?.length ?? 0) < node.childCount || (node.children ?? []).some((child) => incomplete(child));
}

function nameIn(nodes: ReadonlyMap<string, SnapshotNode>): (id: string) => string {
  return (id) => nodes.get(id)?.name ?? "";
}

/** A note when the file's colour profile is not the one the baseline was read in. */
function profileNotes(before: Snapshot, after: Snapshot): string[] {
  const [was, now] = [before.colorProfile ?? "LEGACY", after.colorProfile ?? "LEGACY"];

  return was === now
    ? []
    : [`The file's colour profile changed from ${was} to ${now}: colours are compared as each read wrote them.`];
}

/** Each list cut to the cap, with how many entries each held and how many were left out. */
function capped(changes: BaselineChanges, cap: number, notes: string[]): BaselineDiff {
  const cut = <T>(list: readonly T[]): T[] => list.slice(0, cap);
  const counts: Counts = {
    changed: changes.changed.length,
    added: changes.added.length,
    removed: changes.removed.length,
    moved: changes.moved.length,
    reordered: changes.reordered.length,
    components: changes.components.length,
    tokens: changes.tokens.length,
  };
  const lengths = [...Object.values(counts), changes.notCompared.length];

  return {
    same: Object.values(counts).every((count) => count === 0),
    changes: {
      changed: cut(changes.changed),
      added: cut(changes.added),
      removed: cut(changes.removed),
      moved: cut(changes.moved),
      reordered: cut(changes.reordered),
      components: cut(changes.components),
      tokens: cut(changes.tokens),
      notCompared: cut(changes.notCompared),
    },
    counts,
    more: lengths.reduce((sum, length) => sum + Math.max(0, length - cap), 0),
    notes,
  };
}
