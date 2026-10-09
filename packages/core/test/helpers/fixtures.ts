import { readFileSync } from "node:fs";
import { type Snapshot, type SnapshotNode, SnapshotSchema } from "../../src/index.ts";

/** A snapshot captured from the Positivus file (packages/core/test/fixtures), checked against the schema. */
export function fixture(name: string): Snapshot {
  return SnapshotSchema.parse(JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8")));
}

/** Every node of a snapshot with its parent, in document order. */
export function nodesOf(snapshot: Snapshot): { node: SnapshotNode; parent: SnapshotNode | null }[] {
  const all: { node: SnapshotNode; parent: SnapshotNode | null }[] = [];
  const walk = (node: SnapshotNode, parent: SnapshotNode | null) => {
    all.push({
      node,
      parent,
    });

    for (const child of node.children ?? []) {
      walk(child, node);
    }
  };

  walk(snapshot.root, null);

  return all;
}
