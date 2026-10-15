import type { SnapshotNode } from "../../types/snapshot.ts";

/**
 * Snapshot fields that name or place a layer, or say what it does, rather than draw it: its notes and description,
 * its link and prototype reactions, its animation, its export settings, Figma's own matches and overrides list.
 */
const NOT_DRAWING = new Set([
  "id",
  "name",
  "x",
  "y",
  "bounds",
  "renderBounds",
  "css",
  "description",
  "annotations",
  "href",
  "reactions",
  "motion",
  "exportSettings",
  "inferred",
  "overrides",
]);

/**
 * What draws a layer, without what names or places it: equal for two copies of one icon. With `keeps`, only the fields
 * it keeps count: two reads by different plugin versions compare over what both hold.
 */
export function fingerprint(node: SnapshotNode | undefined, keeps: (key: string) => boolean = () => true): string {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(strip);
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !NOT_DRAWING.has(key) && keeps(key))
        .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, strip(item)]),
    );
  };

  return JSON.stringify(strip(node ?? null));
}

/** Every node of a snapshot by id. */
export function nodesOf(root: SnapshotNode): Map<string, SnapshotNode> {
  const nodes = new Map<string, SnapshotNode>();
  const walk = (node: SnapshotNode) => {
    nodes.set(node.id, node);
    node.children?.forEach(walk);
  };

  walk(root);

  return nodes;
}
