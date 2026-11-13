import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ALIAS_LINKS } from "@/core/tokens/plan/alias-links.ts";
import { PLAIN_NUMBERS } from "@/core/tokens/plan/plain-numbers.ts";
import { PLAN_TEXT } from "@/core/tokens/plan/plan.constants.ts";
import type { CollectionInput } from "@/core/tokens/plan/plan.schema.ts";
import type {
  FileTokens,
  HeldCollection,
  NumberedDrafts,
  UnlinkedCollection,
  UnlinkedEntry,
} from "@/core/tokens/plan/plan.types.ts";
import { VARIABLE_PLANS } from "@/core/tokens/plan/variable-plans.ts";
import { TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { TokenError } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/**
 * The call's collections set against the file's of their name (K-021, K-025): each collection found or made, its modes
 * in the order they first appear, each variable planned by VariablePlans, then their aliases linked and their numbers
 * written as Figma keeps them. A library's collection is never copied: what the call gives it is an error, and a
 * variable listed twice in a collection is planned once.
 */
@injectable()
export class CollectionPlans {
  readonly #variables;
  readonly #links;
  readonly #numbers;

  constructor(
    variables = inject(VARIABLE_PLANS),
    links = inject(ALIAS_LINKS),
    numbers = inject(PLAIN_NUMBERS),
  ) {
    this.#variables = variables;
    this.#links = links;
    this.#numbers = numbers;
  }

  plan(
    collections: readonly CollectionInput[],
    file: FileTokens,
    errors: TokenError[],
  ): NumberedDrafts {
    const seen = new Set<string>();
    const drafts = collections.flatMap((collection) => this.#draft(collection, file, seen, errors) ?? []);

    return this.#numbers.numbers(this.#links.link(drafts, file, errors), file.units);
  }

  /** A collection of the call set against the file's of its name; null for a library's, whose changes are errors. */
  #draft(
    collection: CollectionInput,
    file: FileTokens,
    seen: Set<string>,
    errors: TokenError[],
  ): UnlinkedCollection | null {
    const found =
      file.collections.find(({ name, remote }) => name === collection.name && !remote) ??
      file.collections.find(({ name }) => name === collection.name);

    if (found === undefined && file.library.has(collection.name)) {
      errors.push({ kind: TOKEN_KIND.collection, name: collection.name, message: PLAN_TEXT.library(collection.name) });

      return null;
    }

    const modes = this.#modes(collection, found);
    const entries = this.#entries(collection, found, seen, errors);

    if (found?.remote ?? false) {
      const message = PLAN_TEXT.library(collection.name);

      errors.push(
        ...modes.map((mode) => ({ kind: TOKEN_KIND.mode, name: mode, collection: collection.name, message })),
        ...entries.map(({ plan }) => ({
          kind: TOKEN_KIND.variable,
          name: plan.name,
          collection: collection.name,
          message,
        })),
      );

      return null;
    }

    return { name: collection.name, ...(found === undefined ? {} : { id: found.id }), modes, entries };
  }

  /** Each variable of the collection planned against the file's of its name; the second of one name is an error. */
  #entries(
    collection: CollectionInput,
    found: HeldCollection | undefined,
    seen: Set<string>,
    errors: TokenError[],
  ): UnlinkedEntry[] {
    return collection.variables.flatMap((input) => {
      const fail = (message: string, mode?: string) =>
        errors.push({
          kind: TOKEN_KIND.variable,
          name: input.name,
          collection: collection.name,
          ...(mode === undefined ? {} : { mode }),
          message,
        });
      const key = JSON.stringify([collection.name, input.name]);

      if (seen.has(key)) {
        fail(PLAN_TEXT.twice(input.name, collection.name));

        return [];
      }

      seen.add(key);

      return (
        this.#variables.plan(
          input,
          found?.variables.find(({ name }) => name === input.name),
          fail,
        ) ?? []
      );
    });
  }

  /** The modes to add: those the call names that the collection lacks, in the order they first appear (K-025). */
  #modes(collection: CollectionInput, found: HeldCollection | undefined): string[] {
    const named = new Set([
      ...(collection.modes ?? []),
      ...collection.variables.flatMap(({ values }) => Object.keys(values)),
    ]);

    return [...named].filter((mode) => !(found?.modes.includes(mode) ?? false));
  }
}

export const COLLECTION_PLANS = new InjectionToken<CollectionPlans>("CollectionPlans");
