import type { RawTokens } from "../../tokens/raw-tokens.ts";
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

/**
 * The variables the bound ones alias, at any depth (a semantic token's primitive), each with the bound ones it is
 * reached through: changing a primitive changes every layer bound to an alias of it.
 */
export function aliasedVariables(bound: ReadonlySet<string>, raw: RawTokens): Map<string, Set<string>> {
  const byId = new Map(raw.variables.map((variable) => [variable.id, variable]));
  const reached = new Map<string, Set<string>>();

  for (const start of bound) {
    for (const target of aliasClosure(start, byId)) {
      if (!bound.has(target)) {
        reached.set(target, (reached.get(target) ?? new Set()).add(start));
      }
    }
  }

  return reached;
}

/** The variables one aliases, at any depth, itself left out. */
function aliasClosure(start: string, byId: ReadonlyMap<string, RawTokens["variables"][number]>): Set<string> {
  const seen = new Set([start]);
  const queue = [start];

  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const target of aliasTargets(byId.get(id)?.valuesByMode ?? {})) {
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }

  seen.delete(start);

  return seen;
}

/** The variables a variable's values alias, mode by mode. */
function aliasTargets(valuesByMode: Readonly<Record<string, unknown>>): string[] {
  return Object.values(valuesByMode).flatMap((value) => {
    const alias = value as { type?: unknown; id?: unknown } | null;

    return typeof alias === "object" &&
      alias !== null &&
      alias.type === "VARIABLE_ALIAS" &&
      typeof alias.id === "string"
      ? [alias.id]
      : [];
  });
}
