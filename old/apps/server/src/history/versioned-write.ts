import type { PluginSession } from "../plugin/plugin-session.ts";
import { versionBefore } from "./version-before.ts";

/** What a versioned write gives: its answer, whether that answer is a dry run's, and the version saved first. */
export interface VersionedWrite<R> {
  readonly result: R;
  /** The answer is a dry run's: one asked for, or the check before a version that found nothing to change. */
  readonly dry: boolean;
  readonly version: { readonly id: string | null; readonly title: string } | undefined;
}

/**
 * A write that saves a named version first, and only before a write that changes something: with a title, a dry run
 * first says whether it will, and when it would change nothing, that dry run is the answer and no version is saved.
 * The check, the version and the write go to the one file of the session, whatever comes to the front meanwhile.
 */
export async function versionedWrite<R>(
  session: PluginSession,
  { title, dryRun }: { readonly title: string | undefined; readonly dryRun: boolean },
  { write, changes }: { readonly write: (dry: boolean) => Promise<R>; readonly changes: (result: R) => number },
): Promise<VersionedWrite<R>> {
  const probe = title === undefined || dryRun ? null : await write(true);

  if (probe !== null && changes(probe) === 0) {
    return {
      result: probe,
      dry: true,
      version: undefined,
    };
  }

  const version = await versionBefore(session, {
    title,
    dryRun,
  });

  return {
    result: await write(dryRun),
    dry: dryRun,
    version,
  };
}
