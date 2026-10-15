import { type RawTokens, type TokensPlan, tokenName, type VariablePlan, variableTokenName } from "@pixelwright/core";
import type { TokenRun } from "./token-run.ts";

/** A variable an alias may point at. */
export interface KnownVariable {
  readonly id: string;
  readonly type: string;
}

/** The variables an alias may point at, by CSS name: the file's, the libraries' it uses, and those the call makes. */
export class KnownVariables {
  readonly #byToken = new Map<string, KnownVariable>();

  constructor(raw: RawTokens) {
    for (const variable of raw.variables) {
      this.#byToken.set(variableTokenName(variable), {
        id: variable.id,
        type: variable.resolvedType,
      });
    }

    for (const [id, variable] of Object.entries(raw.external)) {
      this.#byToken.set(variableTokenName(variable), {
        id,
        type: variable.resolvedType,
      });
    }
  }

  get(token: string): KnownVariable | undefined {
    return this.#byToken.get(token);
  }

  has(token: string): boolean {
    return this.#byToken.has(token);
  }

  add(token: string, variable: KnownVariable): void {
    this.#byToken.set(token, variable);
  }

  /**
   * Adds the variables the plan's aliases point at that neither the file nor the plan has: an enabled library's,
   * found by name (imported on a real run, so the alias has its id in the file). One that is nowhere stays unknown,
   * which is that value's error later.
   */
  async addLibraryTargets(plan: TokensPlan, run: TokenRun): Promise<void> {
    const planned = new Set(
      plan.collections.flatMap((collection) =>
        collection.variables.map((variable) => variable.token ?? tokenName(variable.name)),
      ),
    );
    const aliases = plan.collections.flatMap((collection) =>
      collection.variables.flatMap((variable) =>
        Object.values(variable.values).flatMap((value) => (value.kind === "alias" ? [value.token] : [])),
      ),
    );

    for (const token of aliases) {
      if (this.has(token) || planned.has(token)) {
        continue;
      }

      const index = await run.index();
      const found = await (run.dryRun ? index.find(token) : index.variable(token)).catch(() => null);

      if (found !== null) {
        this.add(token, {
          id: found.id,
          type: found.resolvedType,
        });
      }
    }
  }

  /** The type of the first variable the plan's aliases point at that exists: an alias-only variable takes it. */
  aliasTypeOf(plan: VariablePlan): string | null {
    for (const value of Object.values(plan.values)) {
      const target = value.kind === "alias" ? this.#byToken.get(value.token) : undefined;

      if (target !== undefined) {
        return target.type;
      }
    }

    return null;
  }
}
