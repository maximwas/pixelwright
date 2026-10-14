import { type BaselineFile, BridgeError, type PluginInfo } from "@pixelwright/core";
import type * as z from "zod";
import type { BaselineStore } from "../../baselines/baseline-store.ts";
import { baselineTarget } from "../../baselines/baseline-target.ts";
import { type CompareContext, compareBaseline } from "../../baselines/compare-baseline.ts";
import { resolveTarget } from "../../bridge/target.ts";
import { saveVersion } from "../../history/save-version.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { versionDescription } from "./description.ts";
import type { VersionSaveInputSchema, VersionSaveOutputSchema } from "./schemas.ts";
import type { VersionTries } from "./version-tries.ts";

type Args = z.output<typeof VersionSaveInputSchema>;
type Output = z.output<typeof VersionSaveOutputSchema>;

/** What saving a version needs: the plugin and its files, the project's baselines, and the titles tried lately. */
export interface VersionContext extends CompareContext {
  readonly baselines: BaselineStore;
  readonly tries: VersionTries;
}

/**
 * A named version in the file's history, saved only when every check passes: the baselines it goes with exist, come
 * from the file and still match the design; Allow edits is on; the title was not just used. The baselines record it.
 */
export async function saveNamedVersion(context: VersionContext, args: Args): Promise<Output> {
  const baselines = await namedBaselines(context.baselines, args.baselines ?? []);
  const target = targetOf(context, baselines, args.file);
  const session = context.plugin.session(target.session);
  const info = session.info();

  checkFile(baselines, info, args.title);
  checkRepeat(context.tries, target.session, args.title);
  await checkCurrent(context, baselines, target.session);

  const saved = await savedVersion(context.tries, session, {
    title: args.title,
    description: versionDescription(args.description, baselines),
    file: target.session,
  });
  const stamped = await stamp(context.baselines, baselines, {
    id: saved.id,
    title: args.title,
    savedAt: new Date().toISOString(),
  });

  return {
    id: saved.id,
    title: args.title,
    file: info?.file ?? {
      name: "",
      key: null,
    },
    baselines: stamped.names,
    notes: [
      ...target.notes,
      ...stamped.notes,
      ...(saved.description === undefined
        ? ["This plugin saved the title only: update it with npx -y pixelwright@latest."]
        : []),
      ...(saved.id === null ? ["Figma saved the version without giving its id."] : []),
    ],
  };
}

async function namedBaselines(store: BaselineStore, names: readonly string[]): Promise<BaselineFile[]> {
  if (names.length > 0) {
    store.folder();
  }

  const found: BaselineFile[] = [];

  for (const name of names) {
    const baseline = await store.read(name);

    if (baseline === null) {
      throw new BridgeError("OP_FAILED", `No baseline named ${name} in this project: baseline_save keeps one.`);
    }

    found.push(baseline);
  }

  return found;
}

/** The file of the first baseline (or `file`), else the active file. */
function targetOf(context: VersionContext, baselines: readonly BaselineFile[], file: string | undefined) {
  const [first] = baselines;

  return first === undefined
    ? {
        ...resolveTarget(context.bridge.plugins(), file),
        notes: [],
      }
    : baselineTarget(context.bridge.plugins(), first, file);
}

/** Every baseline comes from the file the version goes in, and Allow edits is on there. */
function checkFile(baselines: readonly BaselineFile[], info: PluginInfo | undefined, title: string): void {
  if (info === undefined) {
    return;
  }

  for (const baseline of baselines) {
    const same =
      baseline.file.key === null ? baseline.file.name === info.file.name : baseline.file.key === info.file.key;

    if (!same) {
      throw new BridgeError(
        "OP_FAILED",
        `${baseline.name} comes from ${baseline.file.name}, not ${info.file.name}: save its version there.`,
      );
    }
  }

  if (!info.allowEdits) {
    throw new BridgeError(
      "EDITS_DISABLED",
      `Allow edits is off in ${info.file.name}: turn it on in the Pixelwright window to save the version "${title}".`,
    );
  }
}

function checkRepeat(tries: VersionTries, file: string, title: string): void {
  const at = tries.recent(file, title);

  if (at !== undefined) {
    const minutes = Math.max(1, Math.round((Date.now() - at) / 60_000));

    throw new BridgeError(
      "OP_FAILED",
      `A version named ${title} was saved here ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago (or may have been: that try timed out): check Version history, or use another title.`,
    );
  }
}

/** Each baseline still matches the design: a version goes only with what the code follows. */
async function checkCurrent(context: VersionContext, baselines: readonly BaselineFile[], file: string): Promise<void> {
  for (const baseline of baselines) {
    const comparison = await compareBaseline(context, baseline, { file });

    if ("reason" in comparison) {
      throw new BridgeError("OP_FAILED", `${baseline.name}: ${comparison.reason}`);
    }

    if (comparison.status === "changed") {
      const { changed, added, removed, moved, reordered, components, tokens } = comparison.diff.counts;
      const layers = changed + added + removed + moved + reordered + components;

      throw new BridgeError(
        "OP_FAILED",
        `${baseline.name} changed since it was saved (${layers} ${layers === 1 ? "layer" : "layers"}, ${tokens} ${tokens === 1 ? "token" : "tokens"}): diff it, update the code and accept before saving a version.`,
      );
    }
  }
}

/** Saves the version, noting the try first: a timeout keeps it (the version may be saved), a refusal forgets it. */
async function savedVersion(
  tries: VersionTries,
  session: PluginSession,
  { title, description, file }: { title: string; description: string; file: string },
) {
  tries.note(file, title);

  try {
    return await saveVersion(session, {
      title,
      description,
    });
  } catch (error) {
    if (!(error instanceof BridgeError && error.code === "TIMEOUT")) {
      tries.forget(file, title);
    }

    throw refusalOf(error);
  }
}

function refusalOf(error: unknown): Error {
  if (error instanceof BridgeError && error.code === "UNKNOWN_OP") {
    return new BridgeError(
      "UNKNOWN_OP",
      "The Pixelwright plugin in this file is older than the server and cannot save versions: run npx -y pixelwright@latest to update it.",
    );
  }

  if (error instanceof BridgeError && (error.code === "TIMEOUT" || error.code === "EDITS_DISABLED")) {
    return error;
  }

  return new BridgeError(
    error instanceof BridgeError ? error.code : "OP_FAILED",
    `Figma did not save the version: ${errorMessage(error)}. A version needs Can edit access to the file.`,
  );
}

/** Each baseline records the version, unless it was saved again meanwhile. */
async function stamp(
  store: BaselineStore,
  baselines: readonly BaselineFile[],
  version: NonNullable<BaselineFile["version"]>,
): Promise<{ names: string[]; notes: string[] }> {
  const names: string[] = [];
  const notes: string[] = [];

  for (const baseline of baselines) {
    const current = await store.read(baseline.name);

    if (current?.capturedAt === baseline.capturedAt) {
      await store.write({
        ...current,
        version,
      });
      names.push(baseline.name);
    } else {
      notes.push(`${baseline.name} was saved again meanwhile: the version is saved but not recorded in it.`);
    }
  }

  return {
    names,
    notes,
  };
}
