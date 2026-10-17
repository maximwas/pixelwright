import { aliasOf } from "../aliases.ts";
import type { RawVariable } from "../raw-tokens.ts";
import { type NumberUnit, scopedUnit } from "../scopes.ts";

/**
 * Each number variable's unit: the one its scopes give, else the one the numbers linked with it by aliases agree on (a
 * hidden primitive that font weights point at is a plain number), else px.
 */
export function numberUnits(variables: readonly RawVariable[]): Map<string, NumberUnit> {
  const numbers = variables.filter((variable) => variable.resolvedType === "FLOAT");
  const groups = aliasGroups(numbers);
  const known = new Map<string, Set<NumberUnit>>();

  for (const variable of numbers) {
    const unit = scopedUnit(variable.scopes);
    const group = groups.get(variable.id) ?? variable.id;

    if (unit !== null) {
      known.set(group, (known.get(group) ?? new Set()).add(unit));
    }
  }

  return new Map(
    numbers.map((variable) => {
      const linked = [...(known.get(groups.get(variable.id) ?? variable.id) ?? [])];

      return [variable.id, scopedUnit(variable.scopes) ?? (linked.length === 1 ? (linked[0] ?? "px") : "px")];
    }),
  );
}

/** The numbers joined by aliases, either way: each variable's group, named by one of its members. */
function aliasGroups(numbers: readonly RawVariable[]): Map<string, string> {
  const parent = new Map(numbers.map((variable) => [variable.id, variable.id]));
  const root = (id: string): string => {
    let at = id;

    for (let next = parent.get(at); next !== undefined && next !== at; next = parent.get(at)) {
      at = next;
    }

    return at;
  };

  for (const variable of numbers) {
    for (const value of Object.values(variable.valuesByMode)) {
      const target = aliasOf(value);

      if (target !== null && parent.has(target)) {
        parent.set(root(variable.id), root(target));
      }
    }
  }

  return new Map(numbers.map((variable) => [variable.id, root(variable.id)]));
}
