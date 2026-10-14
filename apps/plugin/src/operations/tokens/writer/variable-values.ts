import {
  isWritableType,
  type RawTokens,
  type TokenVariable,
  tokenName,
  type VariablePlan,
  variableValueOf,
} from "@pixelwright/core";
import { documentColor } from "../../../figma/color-profile.ts";
import { errorMessage } from "../../../utils/error-message.ts";
import type { Target } from "./collections.ts";
import type { FileTokens } from "./file-tokens.ts";
import type { KnownVariables } from "./known-variables.ts";
import { sameSpec } from "./same-values.ts";
import type { TokenRun } from "./token-run.ts";

/** A planned variable and the Figma one it is written to (none for a new one on a dry run). */
export interface WrittenVariable {
  readonly target: Target;
  readonly plan: VariablePlan;
  readonly variable: Variable | null;
  /** The variable as the file holds it, for one that exists. */
  readonly held: RawTokens["variables"][number] | null;
  readonly type: string;
}

/** A value as Figma holds it, or an alias by its target's id. */
type FigmaValue = { readonly value: VariableValue } | { readonly alias: string };

/**
 * Writes a variable's values, description and code syntax where tokens_read's CSS of them differs from the call's, so
 * tokens_read's own JSON fed back writes nothing. Each value Figma refuses is its own error.
 */
export class VariableValueWriter {
  readonly #run: TokenRun;
  readonly #file: FileTokens;
  readonly #known: KnownVariables;

  constructor(run: TokenRun, file: FileTokens, known: KnownVariables) {
    this.#run = run;
    this.#file = file;
    this.#known = known;
  }

  async write(item: WrittenVariable): Promise<void> {
    const { target, plan, held } = item;
    const shown = held === null ? undefined : this.#file.shownVariable(target.plan.name, plan.name);
    const changes = [
      ...(await this.#writeModes(item, shown)),
      await this.#writeDescription(item, shown),
      await this.#writeCodeSyntax(item, shown),
    ];

    if (held !== null && changes.some(Boolean)) {
      this.#run.updated({
        kind: "variable",
        collection: target.plan.name,
        name: plan.name,
      });
    }
  }

  /** Each mode's value whose CSS differs from what tokens_read shows; whether each changes. */
  async #writeModes(item: WrittenVariable, shown: TokenVariable | undefined): Promise<boolean[]> {
    const changes: boolean[] = [];

    for (const [mode, spec] of Object.entries(item.plan.values)) {
      const css = shown?.values[mode];
      const same = css !== undefined && isWritableType(item.type) && sameSpec(variableValueOf(css, item.type), spec);

      changes.push(same ? false : await this.#writeMode(item, mode, spec));
    }

    return changes;
  }

  async #writeDescription(item: WrittenVariable, shown: TokenVariable | undefined): Promise<boolean> {
    const { description } = item.plan;

    if (description === undefined || description === (shown?.description ?? "")) {
      return false;
    }

    return await this.#attempt(item, async (variable) => {
      variable.description = description;
    });
  }

  /** The WEB code syntax, when the call's token is not the one the variable's name gives. */
  async #writeCodeSyntax(item: WrittenVariable, shown: TokenVariable | undefined): Promise<boolean> {
    const { token, name } = item.plan;

    if (token === undefined || token === (shown?.token ?? tokenName(name))) {
      return false;
    }

    return await this.#attempt(item, async (variable) => {
      variable.setVariableCodeSyntax("WEB", `var(${token})`);
    });
  }

  /** One mode's value; whether it changes (on a dry run: would). */
  async #writeMode(item: WrittenVariable, mode: string, spec: VariablePlan["values"][string]): Promise<boolean> {
    const { target } = item;
    const modeId = target.modes.get(mode);

    if (modeId === undefined) {
      if (!target.failed.has(mode)) {
        this.#fail(item, `${target.plan.name} has no mode ${mode}: list it in the collection's modes.`, mode);
      }

      return false;
    }

    const value = this.#figmaValue(spec, item.type);

    if (typeof value === "string") {
      this.#fail(item, value, mode);

      return false;
    }

    return await this.#attempt(
      item,
      async (variable) => {
        variable.setValueForMode(
          modeId,
          "alias" in value
            ? await figma.variables.createVariableAliasByIdAsync(value.alias)
            : stored(value.value, item.held),
        );
      },
      mode,
    );
  }

  /**
   * A value as Figma holds it, an alias by its target's id; a string says why it cannot be written (an alias to
   * nothing, or to a variable of another type).
   */
  #figmaValue(spec: VariablePlan["values"][string], type: string): FigmaValue | string {
    if (spec.kind === "color") {
      return { value: documentColor(spec.color) };
    }

    if (spec.kind !== "alias") {
      return { value: spec.value };
    }

    const target = this.#known.get(spec.token);

    if (target === undefined) {
      return `var(${spec.token}) names no variable of this file or its libraries.`;
    }

    return target.type === type
      ? { alias: target.id }
      : `var(${spec.token}) is a ${target.type} variable, this one is ${type}.`;
  }

  /** Runs a write on the variable, unless dry; whether it changes. What Figma refuses is the variable's error. */
  async #attempt(item: WrittenVariable, write: (variable: Variable) => Promise<void>, mode?: string): Promise<boolean> {
    try {
      if (!this.#run.dryRun && item.variable !== null) {
        await write(item.variable);
        this.#run.wrote();
      }

      return true;
    } catch (error) {
      this.#fail(item, errorMessage(error), mode);

      return false;
    }
  }

  #fail({ target, plan }: WrittenVariable, message: string, mode?: string): void {
    this.#run.failed({
      kind: "variable",
      collection: target.plan.name,
      name: plan.name,
      ...(mode === undefined ? {} : { mode }),
      message,
    });
  }
}

/** A number as Figma stores it: an opacity Figma keeps as a percent (tokens_read shows it divided by 100) is one. */
function stored(value: VariableValue, held: WrittenVariable["held"]): VariableValue {
  return typeof value === "number" && percentStored(held) ? value * 100 : value;
}

/** A variable whose opacity scope Figma fills with percents: tokens_read shows its values divided by 100. */
function percentStored(held: WrittenVariable["held"]): boolean {
  if (held === null) {
    return false;
  }

  return (
    held.scopes.some((scope) => scope === "OPACITY" || scope === "COLOR_OPACITY") &&
    Object.values(held.valuesByMode).some((value) => typeof value === "number" && value > 1)
  );
}
