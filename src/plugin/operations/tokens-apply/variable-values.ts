import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { PAINTS } from "@/plugin/adapters/figma/paints.ts";
import { LIBRARY_CATALOGUE } from "@/plugin/adapters/figma/variables/library-catalogue.ts";
import { TOKEN_FACTORY } from "@/plugin/adapters/figma/variables/token-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKENS_APPLY_TEXT } from "@/plugin/operations/tokens-apply/tokens-apply.constants.ts";
import type { TokenRun, WrittenVariable } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { PLAN_VALUE, TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { PlanValue, VariableTarget } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/** A write on a variable: a value, its description, its scopes, a platform's code syntax. */
type VariableWrite = (variable: Variable) => Promise<void> | void;

/**
 * A planned variable's values and what it carries, as core planned them (only what differs, numbers as Figma keeps
 * them): colours in the document's space, an alias made from its target (FX-052), its description, scopes and code
 * syntax ("" removes a platform's). What Figma refuses is the variable's error, in its mode; a dry run writes nothing.
 */
@injectable()
export class VariableValues {
  readonly #paints;
  readonly #factory;
  readonly #lookup;
  readonly #catalogue;

  constructor(
    paints = inject(PAINTS),
    factory = inject(TOKEN_FACTORY),
    lookup = inject(NODE_LOOKUP),
    catalogue = inject(LIBRARY_CATALOGUE),
  ) {
    this.#paints = paints;
    this.#factory = factory;
    this.#lookup = lookup;
    this.#catalogue = catalogue;
  }

  /** Every planned value and field; a variable the file held is updated when one of them is written. */
  async write(item: WrittenVariable, run: TokenRun): Promise<void> {
    const changes: boolean[] = [];

    for (const [mode, value] of Object.entries(item.plan.values)) {
      changes.push(await this.#value(item, mode, value, run));
    }

    for (const write of this.#fields(item)) {
      changes.push(await this.#attempt(item, run, write));
    }

    if (item.plan.id !== undefined && changes.some(Boolean)) {
      run.answer.updated.push({ kind: TOKEN_KIND.variable, name: item.plan.name, collection: item.target.plan.name });
    }
  }

  /**
   * The variable a token names, for an alias or a style's colour: an enabled library's imported by its key (a write,
   * m:acc257ba), the file's by id, else the one this call made.
   */
  async variable(
    token: string,
    { id, key }: VariableTarget,
    run: TokenRun,
  ): Promise<Variable> {
    if (key !== undefined) {
      return await this.#catalogue.imported(key);
    }

    const found = id === undefined ? run.made.get(token) : (run.local.get(id) ?? (await this.#lookup.variable(id)));

    if (found === undefined || found === null) {
      throw new WriteError(id === undefined ? TOKENS_APPLY_TEXT.notMade(token) : TOKENS_APPLY_TEXT.gone(token));
    }

    return found;
  }

  /** One mode's value; a mode Figma refused has its own error, and its values are left out. */
  async #value(
    item: WrittenVariable,
    mode: string,
    value: PlanValue,
    run: TokenRun,
  ): Promise<boolean> {
    const modeId = item.target.modes.get(mode);

    if (modeId === undefined) {
      if (!item.target.failed.has(mode)) {
        this.#fail(item, run, TOKENS_APPLY_TEXT.noMode(item.target.plan.name, mode), mode);
      }

      return false;
    }

    return await this.#attempt(
      item,
      run,
      async (variable) => {
        variable.setValueForMode(modeId, await this.#figmaValue(value, run));
      },
      mode,
    );
  }

  async #figmaValue(value: PlanValue, run: TokenRun): Promise<VariableValue> {
    if (value.kind === PLAN_VALUE.color) {
      return this.#paints.colour(value.color);
    }

    if (value.kind !== PLAN_VALUE.alias) {
      return value.value;
    }

    return this.#factory.alias(await this.variable(value.token, value, run));
  }

  /** The description, scopes and code syntax the plan gives: only those that differ from the file's. */
  #fields({ plan: { description, scopes, codeSyntax = {} } }: WrittenVariable): VariableWrite[] {
    const writes: VariableWrite[] = [];

    if (description !== undefined) {
      writes.push((variable) => {
        variable.description = description;
      });
    }

    if (scopes !== undefined) {
      writes.push((variable) => {
        variable.scopes = scopes as VariableScope[];
      });
    }

    for (const [platform, syntax] of Object.entries(codeSyntax)) {
      writes.push((variable) => {
        if (syntax === "") {
          variable.removeVariableCodeSyntax(platform as CodeSyntaxPlatform);
        } else {
          variable.setVariableCodeSyntax(platform as CodeSyntaxPlatform, syntax);
        }
      });
    }

    return writes;
  }

  /** Runs a write on the variable unless dry; whether it changes (would, on a dry run). */
  async #attempt(
    item: WrittenVariable,
    run: TokenRun,
    write: VariableWrite,
    mode?: string,
  ): Promise<boolean> {
    try {
      if (item.variable !== null) {
        await write(item.variable);
        run.wrote = true;
      }

      return true;
    } catch (error) {
      this.#fail(item, run, error instanceof Error ? error.message : String(error), mode);

      return false;
    }
  }

  #fail(
    { target, plan }: WrittenVariable,
    run: TokenRun,
    message: string,
    mode?: string,
  ): void {
    run.answer.errors.push({
      kind: TOKEN_KIND.variable,
      name: plan.name,
      collection: target.plan.name,
      ...(mode === undefined ? {} : { mode }),
      message,
    });
  }
}

export const VARIABLE_VALUES = new InjectionToken<VariableValues>("VariableValues");
