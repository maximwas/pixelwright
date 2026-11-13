import { InjectionToken, inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { TOKEN_FACTORY } from "@/plugin/adapters/figma/variables/token-factory.ts";
import { COLLECTION_WRITER } from "@/plugin/operations/tokens-apply/collection-writer.ts";
import { TOKENS_APPLY_TEXT } from "@/plugin/operations/tokens-apply/tokens-apply.constants.ts";
import type { Target, TokenRun, WrittenVariable } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { VARIABLE_VALUES } from "@/plugin/operations/tokens-apply/variable-values.ts";
import { TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { CollectionPlan, VariablePlan } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/**
 * The planned collections and their variables (T-165, P-163): every new variable made first and known by its token
 * from then on, so an alias finds its target in whatever order the plan lists them; then each one's values and what
 * it carries. A variable Figma refuses, or one gone from the file, is its own error while the rest is written.
 */
@injectable()
export class VariableWriter {
  readonly #factory;
  readonly #collections;
  readonly #values;
  readonly #names;

  constructor(
    factory = inject(TOKEN_FACTORY),
    collections = inject(COLLECTION_WRITER),
    values = inject(VARIABLE_VALUES),
    names = inject(TOKEN_NAMES),
  ) {
    this.#factory = factory;
    this.#collections = collections;
    this.#values = values;
    this.#names = names;
  }

  async write(plans: readonly CollectionPlan[], run: TokenRun): Promise<void> {
    const targets = await this.#collections.targets(plans, run);

    if (targets.length === 0) {
      return;
    }

    await this.#values.list(run);

    const written: WrittenVariable[] = [];

    for (const target of targets) {
      for (const plan of target.plan.variables) {
        const item = plan.id === undefined ? this.#made(target, plan, run) : this.#held(target, plan, run);

        if (item !== null) {
          written.push(item);
        }
      }
    }

    for (const item of written) {
      await this.#values.write(item, run);
    }
  }

  #held(
    target: Target,
    plan: VariablePlan,
    run: TokenRun,
  ): WrittenVariable | null {
    const variable = run.local.get(plan.id ?? "");

    if (variable === undefined) {
      this.#fail(target, plan, TOKENS_APPLY_TEXT.gone(plan.name), run);

      return null;
    }

    return { target, plan, variable: run.dryRun ? null : variable };
  }

  /** A new variable in its collection (none on a dry run), known by its CSS name from now on. */
  #made(
    target: Target,
    plan: VariablePlan,
    run: TokenRun,
  ): WrittenVariable | null {
    try {
      const variable =
        target.collection === null ? null : this.#factory.variable(plan.name, target.collection, plan.type);

      if (variable !== null) {
        run.made.set(this.#names.variable(plan), variable);
        run.wrote = true;
      }

      run.answer.created.push({ kind: TOKEN_KIND.variable, name: plan.name, collection: target.plan.name });

      return { target, plan, variable };
    } catch (error) {
      this.#fail(target, plan, error instanceof Error ? error.message : String(error), run);

      return null;
    }
  }

  #fail(
    target: Target,
    plan: VariablePlan,
    message: string,
    run: TokenRun,
  ): void {
    run.answer.errors.push({ kind: TOKEN_KIND.variable, name: plan.name, collection: target.plan.name, message });
  }
}

export const VARIABLE_WRITER = new InjectionToken<VariableWriter>("VariableWriter");
