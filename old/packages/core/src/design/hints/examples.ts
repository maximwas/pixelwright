import type { SnapshotNode } from "../../types/snapshot.ts";

/** How many examples a hint names. */
export const EXAMPLES = 3;

/** A layer as a hint names it: its id and its name. */
export function labelOf(node: SnapshotNode): string {
  return `${node.id} "${node.name}"`;
}

/** A few of the layers a hint is about, and how many more. */
export function listed(examples: readonly string[]): string {
  return `${examples.slice(0, EXAMPLES).join("; ")}${examples.length > EXAMPLES ? `; and ${examples.length - EXAMPLES} more` : ""}`;
}
