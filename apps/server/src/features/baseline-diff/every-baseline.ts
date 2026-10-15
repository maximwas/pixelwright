import type * as z from "zod";
import type { StoredBaseline } from "../../baselines/baseline-store.ts";
import { compareBaseline } from "../../baselines/compare-baseline.ts";
import { MAX_BASELINES, OVERVIEW_MS } from "../../baselines/constants.ts";
import { resolveTarget } from "../../bridge/target.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { entryOf, plainEntry } from "./baseline-entry.ts";
import type { DiffContext } from "./diff-one.ts";
import type { BaselineDiffOutputSchema, BaselineEntrySchema } from "./schemas.ts";
import { overviewSummary } from "./summary.ts";

type Output = z.output<typeof BaselineDiffOutputSchema>;
type Entry = z.output<typeof BaselineEntrySchema>;

/**
 * Every baseline in the project (or of one file), by name, each compared with the design now as counts; within a minute,
 * the rest left unchecked. A cancelled call stops checking. Without a plugin they are still listed, unavailable.
 */
export async function everyBaseline(
  context: DiffContext,
  file: string | undefined,
  signal: AbortSignal,
): Promise<Output> {
  const all = ofFile(await context.baselines.list(), context, file);
  const shown = all.slice(0, MAX_BASELINES);
  const deadline = Date.now() + OVERVIEW_MS;
  const entries: Entry[] = [];

  for (const stored of shown) {
    entries.push(
      signal.aborted || Date.now() >= deadline ? plainEntry(stored, "unchecked") : await overviewEntry(context, stored),
    );
  }

  const more = all.length - shown.length;

  return {
    summary: overviewSummary(entries, more),
    baselines: entries,
    ...(more === 0 ? {} : { more }),
    notes: [],
  };
}

/** One baseline in the overview: its status and counts, or why it could not be compared. */
async function overviewEntry(context: DiffContext, stored: StoredBaseline): Promise<Entry> {
  if (!("file" in stored)) {
    return plainEntry(stored, "unavailable", `${stored.path} cannot be read: ${stored.error}`);
  }

  try {
    return entryOf(stored.file, stored.path, await compareBaseline(context, stored.file, {}));
  } catch (error) {
    // No plugin, no such file, a file named twice: the baseline is listed with why, the others still checked.
    return plainEntry(stored, "unavailable", errorMessage(error));
  }
}

/** The baselines of the file `file` names (by key when it has one, else by name); all of them without it. */
function ofFile(stored: StoredBaseline[], context: DiffContext, file: string | undefined): StoredBaseline[] {
  if (file === undefined) {
    return stored;
  }

  const plugins = context.bridge.plugins();
  const { session } = resolveTarget(plugins, file);
  const connected = plugins.find((plugin) => plugin.session === session)?.info.file;

  return stored.filter(
    (entry) =>
      "file" in entry &&
      connected !== undefined &&
      (connected.key === null ? entry.file.file.name === connected.name : entry.file.file.key === connected.key),
  );
}
