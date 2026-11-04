import { InjectionToken, injectable } from "@needle-di/core";
import {
  NUMBER_UNIT,
  OPACITY_SCOPES,
  UNITLESS_SCOPES,
  VARIABLE_TYPE,
  VARIABLE_VALUE,
} from "@/core/tokens/model/model.constants.ts";
import type { RawVariable } from "@/shared/ops/variables/variables.schema.ts";

export type NumberUnit = (typeof NUMBER_UNIT)[keyof typeof NUMBER_UNIT];

/**
 * A number variable's unit (K-003, B-057): the one its scopes give, else the one the numbers joined to it by aliases
 * agree on, either way (a hidden primitive that font weights point at is a plain number, not 700px), else px; a group
 * of two units stays px. Reads an alias too, the link the groups are made of.
 */
@injectable()
export class NumberUnits {
  units(variables: readonly RawVariable[]): Map<string, NumberUnit> {
    const numbers = variables.filter((variable) => variable.resolvedType === VARIABLE_TYPE.float);
    const groups = this.#groups(numbers);
    const known = new Map<string, Set<NumberUnit>>();

    for (const variable of numbers) {
      const unit = this.#scoped(variable.scopes);
      const group = groups.get(variable.id) ?? variable.id;

      if (unit !== null) {
        known.set(group, (known.get(group) ?? new Set()).add(unit));
      }
    }

    return new Map(
      numbers.map((variable) => {
        const linked = [...(known.get(groups.get(variable.id) ?? variable.id) ?? [])];
        const agreed = linked.length === 1 ? linked[0] : undefined;

        return [variable.id, this.#scoped(variable.scopes) ?? agreed ?? NUMBER_UNIT.px];
      }),
    );
  }

  /** The id of the variable a value points at, when the value is an alias `{ type: "VARIABLE_ALIAS", id }`. */
  alias(value: unknown): string | null {
    if (typeof value !== "object" || value === null || !("type" in value) || !("id" in value)) {
      return null;
    }

    return value.type === VARIABLE_VALUE.alias && typeof value.id === "string" ? value.id : null;
  }

  /** The unit a number's scopes give it; null when they say nothing of it (no field, or every field). */
  #scoped(scopes: readonly string[]): NumberUnit | null {
    if (scopes.length === 0 || scopes.includes(VARIABLE_VALUE.allScopes)) {
      return null;
    }

    if (!scopes.every((scope) => UNITLESS_SCOPES.includes(scope))) {
      return NUMBER_UNIT.px;
    }

    return scopes.some((scope) => OPACITY_SCOPES.includes(scope)) ? NUMBER_UNIT.opacity : NUMBER_UNIT.number;
  }

  /** Union-find over the aliases between the numbers, either way: each number's group, named by one of its members. */
  #groups(numbers: readonly RawVariable[]): Map<string, string> {
    const parent = new Map(numbers.map((variable) => [variable.id, variable.id]));

    for (const variable of numbers) {
      for (const value of Object.values(variable.valuesByMode)) {
        const target = this.alias(value);

        if (target !== null && parent.has(target)) {
          parent.set(this.#root(parent, variable.id), this.#root(parent, target));
        }
      }
    }

    return new Map(numbers.map((variable) => [variable.id, this.#root(parent, variable.id)]));
  }

  #root(parent: ReadonlyMap<string, string>, id: string): string {
    let at = id;

    for (let next = parent.get(at); next !== undefined && next !== at; next = parent.get(at)) {
      at = next;
    }

    return at;
  }
}

export const NUMBER_UNITS = new InjectionToken<NumberUnits>("NumberUnits");
