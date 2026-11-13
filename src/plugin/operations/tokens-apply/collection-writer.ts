import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKEN_FACTORY } from "@/plugin/adapters/figma/variables/token-factory.ts";
import { MODE_LIMIT } from "@/plugin/app/mode-limit.ts";
import { DRY_MODE, TOKENS_APPLY_TEXT } from "@/plugin/operations/tokens-apply/tokens-apply.constants.ts";
import type { Target, TokenRun } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { CollectionPlan } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/**
 * The planned collections as Figma's (T-166, P-163): the file's own by id with the modes the plan adds, or a new one
 * whose first mode renames Figma's default. A mode Figma refuses is that mode's error and the others are made; a
 * refusal at the file's plan limit is learned, and a dry run refuses past it, or says it cannot know (B-055).
 */
@injectable()
export class CollectionWriter {
  readonly #factory;
  readonly #limit;

  constructor(factory = inject(TOKEN_FACTORY), limit = inject(MODE_LIMIT)) {
    this.#factory = factory;
    this.#limit = limit;
  }

  /** Each planned collection's target; one gone from the file or refused is its error and gives none. */
  async targets(plans: readonly CollectionPlan[], run: TokenRun): Promise<Target[]> {
    if (plans.length === 0) {
      return [];
    }

    const local = await this.#factory.collections();
    // As many modes as one of the file's collections has: what its Figma plan surely allows.
    const proven = Math.max(1, ...local.map(({ modes }) => modes.length));
    const targets: Target[] = [];

    for (const plan of plans) {
      const target = plan.id === undefined ? this.#made(plan, run) : this.#held(plan, local, run);

      if (target !== null) {
        for (const mode of plan.id === undefined ? plan.modes.slice(1) : plan.modes) {
          this.#addMode(target, mode, proven, run);
        }

        targets.push(target);
      }
    }

    return targets;
  }

  #held(
    plan: CollectionPlan,
    local: readonly VariableCollection[],
    run: TokenRun,
  ): Target | null {
    const collection = local.find(({ id }) => id === plan.id);

    if (collection === undefined) {
      run.answer.errors.push({
        kind: TOKEN_KIND.collection,
        name: plan.name,
        message: TOKENS_APPLY_TEXT.gone(plan.name),
      });

      return null;
    }

    return {
      plan,
      collection: run.dryRun ? null : collection,
      modes: new Map(collection.modes.map(({ name, modeId }) => [name, modeId])),
      failed: new Set(),
    };
  }

  /** A new collection, its first mode Figma's default renamed. */
  #made(plan: CollectionPlan, run: TokenRun): Target | null {
    let collection: VariableCollection | null;

    try {
      collection = run.dryRun ? null : this.#factory.collection(plan.name);
    } catch (error) {
      run.answer.errors.push({ kind: TOKEN_KIND.collection, name: plan.name, message: this.#message(error) });

      return null;
    }

    run.wrote ||= collection !== null;
    run.answer.created.push({ kind: TOKEN_KIND.collection, name: plan.name });

    const target: Target = { plan, collection, modes: new Map(), failed: new Set() };
    const [first] = plan.modes;

    if (first !== undefined) {
      const id = collection?.defaultModeId ?? DRY_MODE;

      collection?.renameMode(id, first);
      target.modes.set(first, id);
      run.answer.created.push({ kind: TOKEN_KIND.mode, name: first, collection: plan.name });
    }

    return target;
  }

  /** One mode added; a refusal is the mode's error, and one at the plan's limit teaches the limit. */
  #addMode(
    target: Target,
    name: string,
    proven: number,
    run: TokenRun,
  ): void {
    const count = target.modes.size + 1;
    const known = this.#limit.known();

    if (run.dryRun && known !== null && count > known) {
      this.#refuse(target, name, TOKENS_APPLY_TEXT.planLimit(known, name), run);

      return;
    }

    try {
      target.modes.set(name, target.collection?.addMode(name) ?? DRY_MODE);
      run.wrote ||= target.collection !== null;
      run.answer.created.push({ kind: TOKEN_KIND.mode, name, collection: target.plan.name });

      if (run.dryRun && known === null && count > proven) {
        run.answer.notes.push(TOKENS_APPLY_TEXT.unknownLimit(proven, target.plan.name, count, name));
      }
    } catch (error) {
      const message = this.#message(error);
      const limit = this.#limit.learn(message);

      this.#refuse(target, name, limit === null ? message : TOKENS_APPLY_TEXT.planLimit(limit, name), run);
    }
  }

  #refuse(
    target: Target,
    name: string,
    message: string,
    run: TokenRun,
  ): void {
    target.failed.add(name);
    run.answer.errors.push({ kind: TOKEN_KIND.mode, name, collection: target.plan.name, message });
  }

  #message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export const COLLECTION_WRITER = new InjectionToken<CollectionWriter>("CollectionWriter");
