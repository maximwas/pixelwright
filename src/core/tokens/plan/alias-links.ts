import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PLAN_TEXT } from "@/core/tokens/plan/plan.constants.ts";
import type {
  CollectionDraft,
  FileTokens,
  HeldTarget,
  UnlinkedCollection,
  UnlinkedEntry,
  VariableEntry,
} from "@/core/tokens/plan/plan.types.ts";
import { VARIABLE_VALUES } from "@/core/tokens/plan/variable-values.ts";
import { SCOPE_RULES } from "@/core/tokens/scopes/scope-rules.ts";
import { PLAN_VALUE, TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { PlanValue, TokenError } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/** What the call's variables and the file make of each token, for the checks of one pass. */
interface Links {
  readonly calls: ReadonlyMap<string, UnlinkedEntry>;
  /** The file's variables by id: the aliases a variable the call changes holds now. */
  readonly held: ReadonlyMap<string, HeldTarget>;
  readonly file: FileTokens;
  /** Each variable of the call's type: its own, or the type of the first alias target that has one. */
  readonly types: ReadonlyMap<string, string>;
}

/** Why a variable, or one of its modes, cannot be linked. */
interface Problem {
  readonly mode?: string;
  readonly message: string;
}

/**
 * The call's aliases followed to their targets (K-019, K-024): the target must be in the file or in the call, no alias
 * leads back to its own variable (through the call's variables and the file's own aliases), and an alias takes a target
 * of its variable's type. A new variable of only aliases takes its target's type, so its scopes are checked by it; one
 * nothing types is refused. An alias whose target the file holds carries its id, so the writer need not look again;
 * one to an enabled library's variable carries its key to import.
 * A variable that cannot be linked is its own error and out, and those that pointed at it with it.
 */
@injectable()
export class AliasLinks {
  readonly #values;
  readonly #scopes;

  constructor(values = inject(VARIABLE_VALUES), scopes = inject(SCOPE_RULES)) {
    this.#values = values;
    this.#scopes = scopes;
  }

  link(
    drafts: readonly UnlinkedCollection[],
    file: FileTokens,
    errors: TokenError[],
  ): CollectionDraft[] {
    let kept = [...drafts];
    let links = this.#links(kept, file);

    for (let found = this.#found(kept, links); found.size > 0; found = this.#found(kept, links)) {
      errors.push(...[...found.values()].flat());
      kept = kept.map((draft) => ({ ...draft, entries: draft.entries.filter((entry) => !found.has(entry)) }));
      links = this.#links(kept, file);
    }

    return kept.map((draft) => ({ ...draft, entries: draft.entries.flatMap((entry) => this.#linked(entry, links)) }));
  }

  #links(drafts: readonly UnlinkedCollection[], file: FileTokens): Links {
    const calls = new Map(drafts.flatMap(({ entries }) => entries.map((entry) => [entry.token, entry] as const)));
    const types = new Map<string, string>();
    const links: Links = {
      calls,
      held: new Map([...file.tokens.values()].map((target) => [target.id, target] as const)),
      file,
      types,
    };

    for (const [token, { plan }] of calls) {
      if (plan.type !== null) {
        types.set(token, plan.type);
      }
    }

    // A variable takes its first alias target's type once that has one: a chain of aliases is typed from its end.
    for (let progress = true; progress; ) {
      progress = false;

      for (const [token, { plan }] of calls) {
        const derived = types.has(token) ? undefined : this.#derived(plan.values, links);

        if (derived !== undefined) {
          types.set(token, derived);
          progress = true;
        }
      }
    }

    return links;
  }

  #derived(values: Readonly<Record<string, PlanValue>>, links: Links): string | undefined {
    return Object.values(values)
      .map((value) => (value.kind === PLAN_VALUE.alias ? this.#typeOf(value.token, links) : undefined))
      .find((type) => type !== undefined);
  }

  /** The type of what a token names; a variable of the call hides the file's of the same token. */
  #typeOf(token: string, links: Links): string | undefined {
    return links.types.get(token) ?? (links.calls.has(token) ? undefined : links.file.tokens.get(token)?.type);
  }

  /** The variables that cannot be linked, with their errors. */
  #found(drafts: readonly UnlinkedCollection[], links: Links): Map<UnlinkedEntry, TokenError[]> {
    return new Map(
      drafts.flatMap(({ name, entries }) =>
        entries.flatMap((entry) => {
          const problems = this.#problems(entry, links);

          return problems.length === 0
            ? []
            : [
              [
                entry,
                problems.map(({ mode, message }) => ({
                  kind: TOKEN_KIND.variable,
                  name: entry.plan.name,
                  collection: name,
                  ...(mode === undefined ? {} : { mode }),
                  message,
                })),
              ] as const,
            ];
        }),
      ),
    );
  }

  #problems(entry: UnlinkedEntry, links: Links): Problem[] {
    const aliases = Object.entries(entry.plan.values).flatMap(([mode, value]) =>
      value.kind === PLAN_VALUE.alias ? this.#alias(entry, mode, value.token, links) : [],
    );

    // A typed variable has had its scopes checked; one typed by its aliases is left: its type, its writing, its scopes.
    if (aliases.length > 0 || entry.plan.type !== null) {
      return aliases;
    }

    const own = links.types.get(entry.token);

    if (own === undefined) {
      // One that points at a variable of the call with no type yet waits: that one is refused, or typed, next pass.
      const waits = Object.values(entry.plan.values).some(
        (value) => value.kind === PLAN_VALUE.alias && links.calls.has(value.token),
      );

      return waits ? [] : [{ message: PLAN_TEXT.noType(entry.plan.name) }];
    }

    const scopes = this.#values.writable(own) ? this.#scopesError(entry, own) : PLAN_TEXT.notWritable(own);

    return scopes === null ? [] : [{ message: scopes }];
  }

  #scopesError(entry: UnlinkedEntry, type: string): string | null {
    return entry.plan.scopes === undefined ? null : this.#scopes.error(type, entry.plan.scopes);
  }

  /** What is wrong with one alias of the variable: a target nowhere, a loop, or another type than its own. */
  #alias(
    entry: UnlinkedEntry,
    mode: string,
    token: string,
    links: Links,
  ): Problem[] {
    if (!links.calls.has(token) && !links.file.tokens.has(token)) {
      return [{ mode, message: PLAN_TEXT.noTarget(token) }];
    }

    const route = this.#route(token, entry.token, links);

    if (route !== null) {
      return [{ mode, message: PLAN_TEXT.cycle([entry.token, ...route]) }];
    }

    const own = links.types.get(entry.token);
    const target = this.#typeOf(token, links);

    return own !== undefined && target !== undefined && own !== target
      ? [{ mode, message: PLAN_TEXT.typeClash(token, target, own) }]
      : [];
  }

  /** The tokens from one to another along aliases, the two included; null when none leads there. */
  #route(
    from: string,
    goal: string,
    links: Links,
  ): string[] | null {
    const seen = new Set<string>();
    const paths = [[from]];

    for (let path = paths.pop(); path !== undefined; path = paths.pop()) {
      const last = path.at(-1) ?? from;

      if (last === goal) {
        return path;
      }

      if (!seen.has(last)) {
        seen.add(last);
        paths.push(...this.#edges(last, links).map((next) => [...path, next]));
      }
    }

    return null;
  }

  /** The tokens a variable's modes point at: the call's value where it gives one, else what the file holds. */
  #edges(token: string, links: Links): string[] {
    const entry = links.calls.get(token);

    if (entry === undefined) {
      return Object.values(links.file.tokens.get(token)?.aliases ?? {});
    }

    const held = entry.plan.id === undefined ? undefined : links.held.get(entry.plan.id);
    const modes = new Map(Object.entries(held?.aliases ?? {}));

    for (const [mode, value] of Object.entries(entry.plan.values)) {
      if (value.kind === PLAN_VALUE.alias) {
        modes.set(mode, value.token);
      } else {
        modes.delete(mode);
      }
    }

    return [...modes.values()];
  }

  /** The variable with its type and the ids of the targets the file holds; none for a type that cannot be written. */
  #linked(entry: UnlinkedEntry, links: Links): VariableEntry[] {
    const type = entry.plan.type ?? links.types.get(entry.token);

    if (type === undefined || !this.#values.writable(type)) {
      return [];
    }

    const values = Object.fromEntries(
      Object.entries(entry.plan.values).map(([mode, value]) => [mode, this.#withId(value, links)]),
    );

    return [{ ...entry, plan: { ...entry.plan, type, values } }];
  }

  #withId(value: PlanValue, links: Links): PlanValue {
    if (value.kind !== PLAN_VALUE.alias) {
      return value;
    }

    const made = links.calls.get(value.token);
    const held = made === undefined ? links.file.tokens.get(value.token) : undefined;

    if (held?.key !== undefined) {
      return { ...value, key: held.key };
    }

    const id = made === undefined ? held?.id : made.plan.id;

    return id === undefined ? value : { ...value, id };
  }
}

export const ALIAS_LINKS = new InjectionToken<AliasLinks>("AliasLinks");
