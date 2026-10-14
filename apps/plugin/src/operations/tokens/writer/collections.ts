import type { CollectionPlan, RawTokens } from "@pixelwright/core";
import { errorMessage } from "../../../utils/error-message.ts";
import type { TokenRun } from "./token-run.ts";

/** A planned collection being written: Figma's (none for a new one on a dry run) and its modes' ids by name. */
export interface Target {
  readonly plan: CollectionPlan;
  readonly collection: VariableCollection | null;
  readonly modes: Map<string, string>;
  /** Modes that could not be made: their values are not written, the mode's error says why. */
  readonly failed: Set<string>;
}

/**
 * The planned collection's Figma collection and modes: the file's own with the modes it lacks added, or a new one whose
 * first mode renames Figma's default. What Figma refuses is that collection's or mode's error; a refused collection
 * gives no target.
 */
export async function targetOf(
  plan: CollectionPlan,
  local: RawTokens["collections"][number] | undefined,
  run: TokenRun,
): Promise<Target | null> {
  return local === undefined ? newTarget(plan, run) : await existingTarget(plan, local, run);
}

function newTarget(plan: CollectionPlan, run: TokenRun): Target | null {
  let collection: VariableCollection | null = null;

  try {
    collection = run.dryRun ? null : figma.variables.createVariableCollection(plan.name);
  } catch (error) {
    run.failed({
      kind: "collection",
      name: plan.name,
      message: errorMessage(error),
    });

    return null;
  }

  if (collection !== null) {
    run.wrote();
  }

  run.created({
    kind: "collection",
    name: plan.name,
  });

  const target = targetFor(plan, collection, new Map());

  plan.modes.forEach((name, position) => {
    makeMode(target, name, run, () => {
      if (collection === null) {
        return `dry:${name}`;
      }

      if (position > 0) {
        return collection.addMode(name);
      }

      const first = collection.modes[0]?.modeId ?? collection.defaultModeId;

      collection.renameMode(first, name);

      return first;
    });
  });

  return target;
}

async function existingTarget(
  plan: CollectionPlan,
  local: RawTokens["collections"][number],
  run: TokenRun,
): Promise<Target> {
  const collection = run.dryRun ? null : await figma.variables.getVariableCollectionByIdAsync(local.id);
  const target = targetFor(plan, collection, new Map(local.modes.map(({ name, modeId }) => [name, modeId])));

  for (const name of plan.modes.filter((mode) => !target.modes.has(mode))) {
    makeMode(target, name, run, () => {
      if (collection === null) {
        return `dry:${name}`;
      }

      const id = collection.addMode(name);

      run.wrote();

      return id;
    });
  }

  return target;
}

function targetFor(plan: CollectionPlan, collection: VariableCollection | null, modes: Map<string, string>): Target {
  return {
    plan,
    collection,
    modes,
    failed: new Set(),
  };
}

/** Makes one mode by `make`, which returns its id; one Figma refuses is marked failed and is its own error. */
function makeMode(target: Target, name: string, run: TokenRun, make: () => string): void {
  try {
    target.modes.set(name, make());
    run.created({
      kind: "mode",
      collection: target.plan.name,
      name,
    });
  } catch (error) {
    target.failed.add(name);
    run.failed({
      kind: "mode",
      collection: target.plan.name,
      name,
      message: errorMessage(error),
    });
  }
}
