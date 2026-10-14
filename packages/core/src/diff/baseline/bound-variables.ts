import type { RawTokens } from "../../tokens/raw-tokens.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";

/** Fields that name variables a layer does not use: Figma's own matches for raw values, and its CSS. */
const NOT_BOUND: ReadonlySet<string> = new Set(["inferred", "css"]);

const NONE: ReadonlySet<string> = new Set();

/**
 * The variables a snapshot's layers are bound to, at any depth: fields, paints, effects, text runs. The layers in
 * `skip` (and what is inside them) are left out: a branch the comparison cannot pair.
 */
export function boundVariables(root: SnapshotNode, skip: ReadonlySet<string> = NONE): Set<string> {
  const bound = new Set<string>();

  collect(root, {
    skip,
    found: (key, value) => {
      const alias = (typeof value === "object" && value !== null ? value : {}) as { type?: unknown; id?: unknown };

      if (alias.type === "VARIABLE_ALIAS" && typeof alias.id === "string") {
        bound.add(alias.id);

        return true;
      }

      return NOT_BOUND.has(key);
    },
  });

  return bound;
}

/** The styles a snapshot's layers use, at any depth (their fill, stroke, effect, text and grid styles, a run's). */
export function usedStyles(root: SnapshotNode, skip: ReadonlySet<string> = NONE): Set<string> {
  const used = new Set<string>();

  collect(root, {
    skip,
    found: (key, value) => {
      if (key.endsWith("StyleId") && typeof value === "string" && value !== "") {
        used.add(value);
      }

      return NOT_BOUND.has(key);
    },
  });

  return used;
}

/** How a walk reads a value: true when it is done with it (taken, or a field never walked into). */
interface Walk {
  readonly skip: ReadonlySet<string>;
  found(key: string, value: unknown): boolean;
}

/** Every value of a snapshot's layers, each with its field's name; a layer in `skip` is not walked into. */
function collect(value: unknown, walk: Walk, key = ""): void {
  if (walk.found(key, value) || typeof value !== "object" || value === null) {
    return;
  }

  if (!Array.isArray(value)) {
    for (const [name, item] of Object.entries(value)) {
      collect(item, walk, name);
    }

    return;
  }

  for (const item of value) {
    if (!(key === "children" && walk.skip.has((item as { id?: string }).id ?? ""))) {
      collect(item, walk, key);
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
