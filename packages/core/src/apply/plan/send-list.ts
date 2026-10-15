import type { ApplyChange } from "../types.ts";

/**
 * The changes the plugin gets: what writes something, and a layer made or moved with its parent and the layers beside
 * it, unchanged, so the plugin finds where it goes. The rest stays here, in document order.
 */
export function changesToSend(changes: readonly ApplyChange[]): ApplyChange[] {
  const placed = changes.filter((change) => change.kind === "create" || (change.move ?? false));
  const parents = new Set(placed.flatMap((change) => (change.parent === null ? [] : [change.parent])));
  const beside = new Set(placed.map((change) => change.parent ?? ""));

  return changes.filter(
    (change) =>
      change.kind === "create" ||
      (change.move ?? false) ||
      change.text !== undefined ||
      Object.keys(change.props).length > 0 ||
      parents.has(change.ref) ||
      beside.has(change.parent ?? ""),
  );
}
