import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";

/** The layers a snapshot holds without all their children, because the read stopped at its size budget. */
export interface ReadCuts {
  /** In the read's root, the root included. */
  readonly inside: readonly SnapshotNode[];
  /** Among the layers above it that lie behind or over it. */
  readonly above: readonly SnapshotNode[];
}

/**
 * Where a read stopped at its size budget: each shown layer holding fewer children than it has. An ancestor's own
 * entry holds only its children that overlap the root, and the layer the root is in as a bare place: neither is cut.
 */
export function readCuts(snapshot: Snapshot): ReadCuts {
  const ancestors = snapshot.ancestors ?? [];

  return {
    inside: cutIn(snapshot.root),
    above: ancestors.flatMap((ancestor, level) => {
      const inner = level === 0 ? snapshot.root.id : ancestors[level - 1]?.id;

      return (ancestor.children ?? []).filter(({ id }) => id !== inner).flatMap(cutIn);
    }),
  };
}

function cutIn(node: SnapshotNode): SnapshotNode[] {
  const own = node.visible && node.childCount > (node.children?.length ?? 0) ? [node] : [];

  return [...own, ...(node.children ?? []).flatMap(cutIn)];
}
