import { InjectionToken } from "@needle-di/core";
import type { BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";
import type { BaselineFile } from "@/server/app/baselines/baselines.schema.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";

/** A baseline compared with the design now: why it could not be, or whether it is the same and what changed. */
type BaselineCheck =
  | { readonly reason: string }
  | { readonly diff: { readonly same: boolean; readonly counts: BaselineCounts } };

/** baseline_diff's comparison, as version_save checks a baseline before it saves (T-180); main binds it. */
export interface BaselineComparison {
  compare(baseline: BaselineFile, node: string | undefined, file: string | undefined): Promise<BaselineCheck>;
}

/** baseline_diff's file rule (T-207): the session a baseline's file is in, with a note when `file` names another. */
export interface BaselineFileTarget {
  target(
    came: BaselineFile["file"],
    file: string | undefined,
  ): { readonly session: PluginSession; readonly notes: string[] };
}

export const BASELINE_COMPARISON = new InjectionToken<BaselineComparison>("BaselineComparison");

export const BASELINE_FILE_TARGET = new InjectionToken<BaselineFileTarget>("BaselineFileTarget");
