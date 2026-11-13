import { InjectionToken, inject, injectable } from "@needle-di/core";
import { HELD_TOKENS } from "@/core/tokens/plan/held-tokens.ts";
import { PLAIN_NUMBERS } from "@/core/tokens/plan/plain-numbers.ts";
import { PLAN_TEXT } from "@/core/tokens/plan/plan.constants.ts";
import type { CollectionInput, TokensInput } from "@/core/tokens/plan/plan.schema.ts";
import type {
  CollectionDraft,
  FileTokens,
  HeldCollection,
  PlannedTokens,
  VariableEntry,
} from "@/core/tokens/plan/plan.types.ts";
import { STYLE_PLANS } from "@/core/tokens/plan/style-plans.ts";
import { VARIABLE_PLANS } from "@/core/tokens/plan/variable-plans.ts";
import { PLAN_VALUE, TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { TokenError, TokenItem } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * tokens_apply's plan (T-165, K-018..K-025): tokens_read's JSON, or the same shape by hand, set against the file's own
 * tokens by name. What the file lacks is made, what it holds is changed only where its CSS reads otherwise, nothing is
 * deleted, and a library's collection or style is never copied (one equal to the call's passes, another is an error).
 * Modes come in the order they first appear; what Figma would refuse, or tokens_apply cannot write, is that token's
 * error while the rest is planned; an alias needs its target in the file or in the call.
 */
@injectable()
export class TokensPlan {
  readonly #held;
  readonly #variables;
  readonly #styles;
  readonly #numbers;

  constructor(
    held = inject(HELD_TOKENS),
    variables = inject(VARIABLE_PLANS),
    styles = inject(STYLE_PLANS),
    numbers = inject(PLAIN_NUMBERS),
  ) {
    this.#held = held;
    this.#variables = variables;
    this.#styles = styles;
    this.#numbers = numbers;
  }

  plan(input: TokensInput, raw: RawTokens): PlannedTokens {
    const file = this.#held.of(raw);
    const errors: TokenError[] = [];
    const drafts = input.collections.flatMap((collection) => this.#draft(collection, file, errors) ?? []);
    const { drafts: numbered, notes } = this.#numbers.numbers(this.#linked(drafts, file, errors), file.units);
    const kept = numbered.filter(
      ({ id, modes, entries }) => id === undefined || modes.length > 0 || entries.length > 0,
    );
    const styles = this.#styles.plan(input.styles, file.styles);

    return {
      plan: {
        collections: kept.map(({ name, id, modes, entries }) => ({
          name,
          ...(id === undefined ? {} : { id }),
          modes: [...modes],
          variables: entries.map(({ plan }) => plan),
        })),
        styles: styles.styles,
      },
      created: [...kept.flatMap((draft) => this.#created(draft)), ...styles.created],
      updated: [
        ...kept.flatMap(({ name, entries }) =>
          entries.flatMap(({ plan }) => (plan.id === undefined ? [] : [this.#named(plan.name, name)])),
        ),
        ...styles.updated,
      ],
      errors: [...errors, ...styles.errors],
      notes,
    };
  }

  /** A collection of the call set against the file's of its name; null for a library's, whose changes are errors. */
  #draft(
    collection: CollectionInput,
    file: FileTokens,
    errors: TokenError[],
  ): CollectionDraft | null {
    const found =
      file.collections.find(({ name, remote }) => name === collection.name && !remote) ??
      file.collections.find(({ name }) => name === collection.name);

    if (found === undefined && file.library.has(collection.name)) {
      errors.push({ kind: TOKEN_KIND.collection, name: collection.name, message: PLAN_TEXT.library(collection.name) });

      return null;
    }

    const modes = this.#modes(collection, found);
    const entries = collection.variables.flatMap((input) => {
      const fail = (message: string, mode?: string) =>
        errors.push({ ...this.#named(input.name, collection.name), ...(mode === undefined ? {} : { mode }), message });

      return (
        this.#variables.plan(
          input,
          found?.variables.find(({ name }) => name === input.name),
          fail,
        ) ?? []
      );
    });

    if (found?.remote ?? false) {
      const message = PLAN_TEXT.library(collection.name);

      errors.push(
        ...modes.map((mode) => ({ kind: TOKEN_KIND.mode, name: mode, collection: collection.name, message })),
        ...entries.map(({ plan }) => ({ ...this.#named(plan.name, collection.name), message })),
      );

      return null;
    }

    return { name: collection.name, ...(found === undefined ? {} : { id: found.id }), modes, entries };
  }

  /** The modes to add: those the call names that the collection lacks, in the order they first appear (K-025). */
  #modes(collection: CollectionInput, found: HeldCollection | undefined): string[] {
    const named = new Set([
      ...(collection.modes ?? []),
      ...collection.variables.flatMap(({ values }) => Object.keys(values)),
    ]);

    return [...named].filter((mode) => !(found?.modes.includes(mode) ?? false));
  }

  /** The drafts without the variables whose aliases point at no token of the file or of the call, each an error. */
  #linked(
    drafts: readonly CollectionDraft[],
    file: FileTokens,
    errors: TokenError[],
  ): CollectionDraft[] {
    let kept = [...drafts];

    // A variable left out leaves out those pointing at it in turn.
    for (let broken = this.#broken(kept, file); broken.size > 0; broken = this.#broken(kept, file)) {
      errors.push(...[...broken.values()].flat());
      kept = kept.map((draft) => ({ ...draft, entries: draft.entries.filter((entry) => !broken.has(entry)) }));
    }

    return kept;
  }

  #broken(drafts: readonly CollectionDraft[], file: FileTokens): Map<VariableEntry, TokenError[]> {
    const known = new Set([...file.tokens, ...drafts.flatMap(({ entries }) => entries.map(({ token }) => token))]);

    return new Map(
      drafts.flatMap(({ name, entries }) =>
        entries.flatMap((entry) => {
          const missing = Object.entries(entry.plan.values).flatMap(([mode, value]) =>
            value.kind === PLAN_VALUE.alias && !known.has(value.token)
              ? [{ ...this.#named(entry.plan.name, name), mode, message: PLAN_TEXT.noTarget(value.token) }]
              : [],
          );

          return missing.length === 0 ? [] : [[entry, missing] as const];
        }),
      ),
    );
  }

  /** What a collection's plan makes: the collection when it is new, its modes, its new variables. */
  #created({ name, id, modes, entries }: CollectionDraft): TokenItem[] {
    return [
      ...(id === undefined ? [{ kind: TOKEN_KIND.collection, name }] : []),
      ...modes.map((mode) => ({ kind: TOKEN_KIND.mode, name: mode, collection: name })),
      ...entries.flatMap(({ plan }) => (plan.id === undefined ? [this.#named(plan.name, name)] : [])),
    ];
  }

  #named(name: string, collection: string): { kind: typeof TOKEN_KIND.variable; name: string; collection: string } {
    return { kind: TOKEN_KIND.variable, name, collection };
  }
}

export const TOKENS_PLAN = new InjectionToken<TokensPlan>("TokensPlan");
