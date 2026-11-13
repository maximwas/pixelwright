import { BIND_DECISION, BIND_NUMBER, BIND_VALUE } from "@/core/tokens/bind/bind.constants.ts";
import type { BindResult } from "@/core/tokens/bind/bind.schema.ts";
import type { BindDecision, BindKind, BindUse } from "@/core/tokens/bind/bind.types.ts";

/** Uses of one value in one field with one outcome. */
interface Group {
  readonly kind: BindKind;
  readonly field: string;
  readonly value: string;
  count: number;
  readonly examples: string[];
}

type BoundGroup = Group & { readonly token: string; readonly snapped?: true };

type AmbiguousGroup = Group & { readonly candidates: string[] };

/** What a bind call found, by value (T-167): bound, left for a pick, or with no token; and the layers it changes. */
export class BindReport {
  readonly #bound = new Map<string, BoundGroup>();
  readonly #ambiguous = new Map<string, AmbiguousGroup>();
  readonly #unmatched = new Map<string, Group>();
  readonly #remapped = new Map<string, BindResult["remapped"][number]>();
  readonly #changed = new Set<string>();
  readonly #errors = new Map<string, BindResult["errors"][number]>();
  readonly #notes: string[] = [];

  /** One raw value as its decision has it: bound, listed with its candidates, unmatched, or its pick an error. */
  add(use: BindUse, decision: BindDecision): void {
    if (decision.kind === BIND_DECISION.refused) {
      this.error(use.layer, decision.message);
    } else if (decision.kind === BIND_DECISION.ambiguous) {
      const candidates = use.candidates.map(({ token }) => token);

      this.#count(this.#ambiguous, use, candidates.join(BIND_VALUE.keyJoint), (group) => ({ ...group, candidates }));
    } else if (decision.kind === BIND_DECISION.unmatched) {
      this.#count(this.#unmatched, use, "", (group) => group);
    } else {
      const { token } = decision.candidate;

      this.#count(this.#bound, use, token, (group) => ({
        ...group,
        token,
        ...(decision.snapped ? { snapped: true as const } : {}),
      }));
      this.#changed.add(use.layer);
    }
  }

  remapped(
    from: string,
    to: string,
    layer: string,
    count: number,
  ): void {
    const key = [from, to].join(BIND_VALUE.keyJoint);

    this.#remapped.set(key, { from, to, count: (this.#remapped.get(key)?.count ?? 0) + count });
    this.#changed.add(layer);
  }

  error(id: string, message: string): void {
    if (this.#errors.size < BIND_NUMBER.maxErrors) {
      this.#errors.set([id, message].join(BIND_VALUE.keyJoint), { id, message });
    }
  }

  note(text: string): void {
    this.#notes.push(text);
  }

  result(more: boolean): BindResult {
    return {
      bound: this.#listed(this.#bound),
      ambiguous: this.#listed(this.#ambiguous),
      unmatched: this.#listed(this.#unmatched),
      remapped: [...this.#remapped.values()],
      layers: this.#changed.size,
      errors: [...this.#errors.values()],
      notes: this.#notes,
      more,
    };
  }

  /** Counts a use under its value and outcome, naming its layer while the group has room for examples. */
  #count<Kept extends Group>(
    groups: Map<string, Kept>,
    use: BindUse,
    outcome: string,
    make: (group: Group) => Kept,
  ): void {
    const key = [use.kind, use.field, use.value, outcome].join(BIND_VALUE.keyJoint);
    const group =
      groups.get(key) ?? make({ kind: use.kind, field: use.field, value: use.value, count: 0, examples: [] });

    group.count += 1;

    if (group.examples.length < BIND_NUMBER.examples && !group.examples.includes(use.layer)) {
      group.examples.push(use.layer);
    }

    groups.set(key, group);
  }

  /** A list of groups, most used first (stable), at most BIND_NUMBER.maxGroups. */
  #listed<Kept extends Group>(groups: Map<string, Kept>): Kept[] {
    return [...groups.values()].sort((first, second) => second.count - first.count).slice(0, BIND_NUMBER.maxGroups);
  }
}
