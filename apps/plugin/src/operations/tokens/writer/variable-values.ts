import {
  isWritableType,
  roundTo,
  scopedUnit,
  type TokenVariable,
  type VariablePlan,
  variableValueOf,
} from "@pixelwright/core";
import { documentColor } from "../../../figma/color-profile.ts";
import type { FileTokens } from "./file-tokens.ts";
import type { KnownVariables } from "./known-variables.ts";
import { sameSpec } from "./same-values.ts";
import type { TokenRun } from "./token-run.ts";
import { attempt, failVariable, type WrittenVariable } from "./variable-attempt.ts";
import { writeMeta } from "./variable-meta.ts";

export type { WrittenVariable } from "./variable-attempt.ts";

/** A value as Figma holds it, or an alias by its target's id. */
type FigmaValue = { readonly value: VariableValue } | { readonly alias: string };

/** Whether Figma keeps a variable's numbers as percents (an opacity field's: 50 is 50 %), before the call and after. */
interface PercentStorage {
  readonly before: boolean;
  readonly after: boolean;
}

/**
 * Writes a variable's values, description, scopes and code syntax where tokens_read's CSS of them differs from the
 * call's, so tokens_read's own JSON fed back writes nothing. Each value Figma refuses is its own error.
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
    const changes = [...(await this.#writeModes(item, shown)), ...(await writeMeta(this.#run, item, shown))];

    this.#noteUnitless(item);

    if (held !== null && changes.some(Boolean)) {
      this.#run.updated({
        kind: "variable",
        collection: target.plan.name,
        name: plan.name,
      });
    }
  }

  /**
   * Each mode's value whose CSS differs from what tokens_read shows, or every one when the call changes how Figma keeps
   * the numbers (an opacity's percents); whether each changes.
   */
  async #writeModes(item: WrittenVariable, shown: TokenVariable | undefined): Promise<boolean[]> {
    const percents = percentStorage(item, this.#file);
    const rescaled = percents.before !== percents.after;
    const changes: boolean[] = [];

    for (const [mode, spec] of Object.entries(item.plan.values)) {
      const css = shown?.values[mode];
      const same =
        !rescaled && css !== undefined && isWritableType(item.type) && sameSpec(variableValueOf(css, item.type), spec);

      changes.push(same ? false : await this.#writeMode(item, mode, spec, percents.after));
    }

    return changes;
  }

  /** One mode's value; whether it changes (on a dry run: would). */
  async #writeMode(
    item: WrittenVariable,
    mode: string,
    spec: VariablePlan["values"][string],
    percent: boolean,
  ): Promise<boolean> {
    const modeId = item.target.modes.get(mode);

    if (modeId === undefined) {
      if (!item.target.failed.has(mode)) {
        failVariable(
          this.#run,
          item,
          `${item.target.plan.name} has no mode ${mode}: list it in the collection's modes.`,
          mode,
        );
      }

      return false;
    }

    const value = this.#figmaValue(spec, item.type);

    if (typeof value === "string") {
      failVariable(this.#run, item, value, mode);

      return false;
    }

    return await attempt(
      this.#run,
      item,
      async (variable) => {
        variable.setValueForMode(
          modeId,
          "alias" in value
            ? await figma.variables.createVariableAliasByIdAsync(value.alias)
            : stored(value.value, percent),
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

  /** A number written without a unit that Figma will take for a length: said, with the scopes that keep it plain. */
  #noteUnitless({ target, plan, held }: WrittenVariable): void {
    if (!plan.unitless || (held !== null && this.#file.unitOf(held) !== "px")) {
      return;
    }

    const number = Object.values(plan.values).find((spec) => spec.kind === "number");
    const value = number?.kind === "number" ? String(number.value) : "1";

    this.#run.noted(
      `${plan.name} (${target.plan.name}): ${value} has no unit, but Figma offers a number for every field as a length, so tokens_read writes it as ${value}px. Give it scopes ["FONT_WEIGHT"] for a font weight, ["OPACITY"] for an opacity or ["TEXT_CONTENT"] for a number shown as text, or write ${value}px.`,
    );
  }
}

/**
 * How Figma keeps the variable's numbers, before the call and after: as percents when they are an opacity's that the
 * file keeps so (some value past 1), a new opacity's, or those of a variable the call scopes as an opacity that was
 * none; scopes saying nothing of a unit keep the file's way.
 */
function percentStorage({ held, plan }: WrittenVariable, file: FileTokens): PercentStorage {
  const unit = held === null ? null : file.unitOf(held);
  const before =
    unit === "opacity" &&
    held !== null &&
    Object.values(held.valuesByMode).some((value) => typeof value === "number" && value > 1);
  const planned = plan.scopes === undefined ? null : scopedUnit(plan.scopes);

  return {
    before,
    after: planned === null ? before : planned === "opacity" && (before || unit !== "opacity"),
  };
}

/** A number as Figma stores it: a fraction kept as a percent when Figma keeps the variable's numbers so. */
function stored(value: VariableValue, percent: boolean): VariableValue {
  return typeof value === "number" && percent ? roundTo(value * 100, 6) : value;
}
