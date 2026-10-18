import type { BindCandidate, BindKind, BindOutput } from "@pixelwright/core";
import type { RawUse } from "./raw-use.ts";

/** How many groups each list keeps, and layers each group names. */
const MAX_GROUPS = 200;
const EXAMPLES = 3;

/** The most errors a call reports: one wrong pick repeats on every layer with the value. */
const MAX_ERRORS = 100;

/** Uses of one value in one field with one outcome. */
interface Group {
  kind: BindKind;
  field: string;
  value: string;
  count: number;
  examples: string[];
}

type BoundGroup = Group & { token: string; snapped?: true };

type AmbiguousGroup = Group & { candidates: string[] };

/** What a bind call found and did, by value: bound, left for a pick, or with no token; and the layers changed. */
export class BindReport {
  readonly #bound = new Map<string, BoundGroup>();
  readonly #ambiguous = new Map<string, AmbiguousGroup>();
  readonly #unmatched = new Map<string, Group>();
  readonly #remapped = new Map<string, BindOutput["remapped"][number]>();
  readonly #changed = new Set<string>();
  readonly #errors = new Map<string, BindOutput["errors"][number]>();
  readonly #notes: string[] = [];

  bound(use: RawUse, candidate: BindCandidate, snapped: boolean): void {
    this.#count(this.#bound, use, candidate.token, (group) => ({
      ...group,
      token: candidate.token,
      ...(snapped ? { snapped: true as const } : {}),
    }));
    this.#changed.add(use.layer.id);
  }

  ambiguous(use: RawUse): void {
    const candidates = use.candidates.map(({ token }) => token);

    this.#count(this.#ambiguous, use, candidates.join(" "), (group) => ({
      ...group,
      candidates,
    }));
  }

  unmatched(use: RawUse): void {
    this.#count(this.#unmatched, use, "", (group) => group);
  }

  remapped(from: string, to: string, layer: SceneNode, count: number): void {
    const key = `${from} ${to}`;
    const held = this.#remapped.get(key);

    this.#remapped.set(key, {
      from,
      to,
      count: (held?.count ?? 0) + count,
    });
    this.#changed.add(layer.id);
  }

  error(id: string, message: string): void {
    if (this.#errors.size < MAX_ERRORS) {
      this.#errors.set(`${id} ${message}`, {
        id,
        message,
      });
    }
  }

  note(text: string): void {
    this.#notes.push(text);
  }

  /** Whether anything was (or in a dry run would be) written. */
  get wrote(): boolean {
    return this.#changed.size > 0;
  }

  result(more: boolean): BindOutput {
    return {
      bound: listed(this.#bound),
      ambiguous: listed(this.#ambiguous),
      unmatched: listed(this.#unmatched),
      remapped: [...this.#remapped.values()],
      layers: this.#changed.size,
      errors: [...this.#errors.values()],
      notes: this.#notes,
      more,
    };
  }

  /** Counts a use under its value and outcome, naming its layer while the group has room for examples. */
  #count<G extends Group>(groups: Map<string, G>, use: RawUse, outcome: string, make: (group: Group) => G): void {
    const key = [use.kind, use.field, use.value, outcome].join("|");
    const group =
      groups.get(key) ??
      make({
        kind: use.kind,
        field: use.field,
        value: use.value,
        count: 0,
        examples: [],
      });

    group.count += 1;

    if (group.examples.length < EXAMPLES && !group.examples.includes(use.layer.id)) {
      group.examples.push(use.layer.id);
    }

    groups.set(key, group);
  }
}

/** A list of groups, most used first (stable), at most MAX_GROUPS. */
function listed<G extends Group>(groups: Map<string, G>): G[] {
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, MAX_GROUPS);
}
