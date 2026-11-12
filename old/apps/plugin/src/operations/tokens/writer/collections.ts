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
  return local === undefined ? await newTarget(plan, run) : await existingTarget(plan, local, run);
}

/**
 * What a dry run knows of the plan's limit on modes, which the Plugin API does not give: the limit Figma refused a mode
 * at in this file, else as many as one of the file's collections has.
 */
interface ModeRoom {
  readonly known: number | null;
  readonly proven: number;
}

/** A mode to make: its name and how many modes its collection has with it. */
interface NewMode {
  readonly name: string;
  readonly count: number;
  readonly room: ModeRoom;
}

async function roomOf(run: TokenRun): Promise<ModeRoom> {
  return {
    known: run.modeLimit.known,
    proven: run.dryRun ? await run.provenModes() : Number.POSITIVE_INFINITY,
  };
}

async function newTarget(plan: CollectionPlan, run: TokenRun): Promise<Target | null> {
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
  const room = await roomOf(run);

  plan.modes.forEach((name, position) => {
    makeMode(
      target,
      {
        name,
        count: position + 1,
        room,
      },
      run,
      () => {
        if (collection === null) {
          return `dry:${name}`;
        }

        if (position > 0) {
          return collection.addMode(name);
        }

        const first = collection.modes[0]?.modeId ?? collection.defaultModeId;

        collection.renameMode(first, name);

        return first;
      },
    );
  });

  return target;
}

async function existingTarget(
  plan: CollectionPlan,
  local: RawTokens["collections"][number],
  run: TokenRun,
): Promise<Target> {
  const collection = run.dryRun ? null : await run.lookup.collection(local.id);
  const target = targetFor(plan, collection, new Map(local.modes.map(({ name, modeId }) => [name, modeId])));
  const room = await roomOf(run);

  for (const [index, name] of plan.modes.filter((mode) => !target.modes.has(mode)).entries()) {
    makeMode(
      target,
      {
        name,
        count: local.modes.length + index + 1,
        room,
      },
      run,
      () => {
        if (collection === null) {
          return `dry:${name}`;
        }

        const id = collection.addMode(name);

        run.wrote();

        return id;
      },
    );
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

/**
 * Makes one mode by `make`, which returns its id; one Figma refuses is marked failed and is its own error, and a refusal
 * at the plan's limit is remembered. A dry run refuses a mode past a limit Figma gave, and notes one past what the file
 * shows its plan allows.
 */
function makeMode(target: Target, { name, count, room }: NewMode, run: TokenRun, make: () => string): void {
  if (run.dryRun && room.known !== null && count > room.known) {
    refuseMode(target, name, run, planLimitMessage(room.known, name));

    return;
  }

  try {
    target.modes.set(name, make());
    run.created({
      kind: "mode",
      collection: target.plan.name,
      name,
    });

    if (room.known === null && count > room.proven) {
      run.noted(
        `No collection in this file has more than ${modesOf(room.proven)}, so a dry run cannot tell whether its Figma plan lets ${target.plan.name} have ${count} (Starter allows 1): if not, the write refuses ${name} and leaves its values out.`,
      );
    }
  } catch (error) {
    const limit = /Limited to (\d+) modes?/i.exec(errorMessage(error))?.[1];

    if (limit !== undefined) {
      run.modeLimit.learn(Number(limit));
    }

    refuseMode(target, name, run, limit === undefined ? errorMessage(error) : planLimitMessage(Number(limit), name));
  }
}

function refuseMode(target: Target, name: string, run: TokenRun, message: string): void {
  target.failed.add(name);
  run.failed({
    kind: "mode",
    collection: target.plan.name,
    name,
    message,
  });
}

/** Figma's refusal of a mode past the plan's limit ("in addMode: Limited to 1 modes only"), in plain words. */
function planLimitMessage(limit: number, mode: string): string {
  return `The file's Figma plan allows ${modesOf(limit)} in a collection: ${mode} is not added, and its values are left out.`;
}

function modesOf(count: number): string {
  return `${count} mode${count === 1 ? "" : "s"}`;
}
