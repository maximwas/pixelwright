import type { SnapshotNode } from "../../types/snapshot.ts";

/** Fields that name variables a layer does not use: Figma's own matches for raw values, and its CSS. */
const NOT_BOUND: ReadonlySet<string> = new Set(["inferred", "css"]);

/** The variables a snapshot's layers are bound to, at any depth: fields, paints, effects, text runs. */
export function boundVariables(root: SnapshotNode): Set<string> {
  const bound = new Set<string>();

  collect(root, bound);

  return bound;
}

function collect(value: unknown, bound: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, bound);
    }

    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;

  if (record.type === "VARIABLE_ALIAS" && typeof record.id === "string") {
    bound.add(record.id);

    return;
  }

  for (const [key, item] of Object.entries(record)) {
    if (!NOT_BOUND.has(key)) {
      collect(item, bound);
    }
  }
}
