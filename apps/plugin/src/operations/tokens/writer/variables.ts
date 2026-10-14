import { type CollectionPlan, tokenName, type VariablePlan } from "@pixelwright/core";
import { errorMessage } from "../../../utils/error-message.ts";
import { type Target, targetOf } from "./collections.ts";
import type { FileTokens } from "./file-tokens.ts";
import type { KnownVariables } from "./known-variables.ts";
import { libraryDifferences } from "./library-guard.ts";
import type { TokenRun } from "./token-run.ts";
import { VariableValueWriter, type WrittenVariable } from "./variable-values.ts";

/** An alias-only variable waiting for its target to exist (made later in the call). */
interface Pending {
  readonly target: Target;
  readonly plan: VariablePlan;
}

/**
 * Writes the planned collections: each found by name among the file's own or made, never a library's; its variables
 * found by name or made (an alias-only one once its target exists), then their values written.
 */
export class VariableWriter {
  readonly #run: TokenRun;
  readonly #file: FileTokens;
  readonly #known: KnownVariables;
  readonly #written: WrittenVariable[] = [];
  readonly #pending: Pending[] = [];

  constructor(run: TokenRun, file: FileTokens, known: KnownVariables) {
    this.#run = run;
    this.#file = file;
    this.#known = known;
  }

  async write(collections: readonly CollectionPlan[]): Promise<void> {
    for (const collection of collections) {
      await this.#collection(collection);
    }

    this.#makeAliasOnly();

    const values = new VariableValueWriter(this.#run, this.#file, this.#known);

    for (const item of this.#written) {
      await values.write(item);
    }
  }

  async #collection(plan: CollectionPlan): Promise<void> {
    const local = this.#file.localCollection(plan.name);

    if (local === undefined && this.#file.isLibraryCollection(plan.name)) {
      for (const error of libraryDifferences(plan, this.#file)) {
        this.#run.failed(error);
      }

      return;
    }

    const target = await targetOf(plan, local, this.#run);

    if (target === null) {
      return;
    }

    for (const variable of plan.variables) {
      const held = local === undefined ? undefined : this.#file.heldVariable(local, variable.name);

      if (held !== undefined) {
        await this.#take(target, variable, held);
      } else if (variable.type === null) {
        // Only aliases: it takes its target's type, once the targets of the call exist.
        this.#pending.push({
          target,
          plan: variable,
        });
      } else {
        this.#make(target, variable, variable.type);
      }
    }
  }

  /** A variable the file holds, to write unless the call gives it another type. */
  async #take(target: Target, plan: VariablePlan, held: NonNullable<WrittenVariable["held"]>): Promise<void> {
    if (plan.type !== null && plan.type !== held.resolvedType) {
      this.#fail(target, plan, `${plan.name} is a ${held.resolvedType} variable: its values cannot be ${plan.type}.`);

      return;
    }

    this.#written.push({
      target,
      plan,
      variable: await figma.variables.getVariableByIdAsync(held.id),
      held,
      type: held.resolvedType,
    });
  }

  /** A new variable in its collection, known by its CSS name from now on; one Figma refuses is its error. */
  #make(target: Target, plan: VariablePlan, type: string): void {
    let variable: Variable | null = null;

    try {
      variable =
        target.collection === null
          ? null
          : figma.variables.createVariable(plan.name, target.collection, type as VariableResolvedDataType);
    } catch (error) {
      this.#fail(target, plan, errorMessage(error));

      return;
    }

    if (variable !== null) {
      this.#run.wrote();
    }

    this.#known.add(plan.token ?? tokenName(plan.name), {
      id: variable?.id ?? `dry:${target.plan.name}/${plan.name}`,
      type,
    });
    this.#run.created({
      kind: "variable",
      collection: target.plan.name,
      name: plan.name,
    });
    this.#written.push({
      target,
      plan,
      variable,
      held: null,
      type,
    });
  }

  /** Alias-only new variables, each made as soon as one of its targets exists; those left point at nothing. */
  #makeAliasOnly(): void {
    let progress = true;

    while (progress && this.#pending.length > 0) {
      progress = false;

      for (const item of [...this.#pending]) {
        const type = this.#known.aliasTypeOf(item.plan);

        if (type !== null) {
          this.#pending.splice(this.#pending.indexOf(item), 1);
          this.#make(item.target, item.plan, type);
          progress = true;
        }
      }
    }

    for (const { target, plan } of this.#pending) {
      const aliases = Object.values(plan.values).flatMap((value) =>
        value.kind === "alias" ? [`var(${value.token})`] : [],
      );

      this.#fail(target, plan, `${aliases.join(", ")} names no variable of this file.`);
    }
  }

  #fail(target: Target, plan: VariablePlan, message: string): void {
    this.#run.failed({
      kind: "variable",
      collection: target.plan.name,
      name: plan.name,
      message,
    });
  }
}
