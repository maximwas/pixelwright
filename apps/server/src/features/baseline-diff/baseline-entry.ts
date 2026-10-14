import type { BaselineFile } from "@pixelwright/core";
import type * as z from "zod";
import type { StoredBaseline } from "../../baselines/baseline-store.ts";
import type { Comparison } from "./compare-baseline.ts";
import type { BaselineEntrySchema } from "./schemas.ts";

type Entry = z.output<typeof BaselineEntrySchema>;

/** A baseline as an answer lists it: what it holds, and how it compares now. */
export function entryOf(baseline: BaselineFile, path: string, comparison: Comparison): Entry {
  return {
    ...headerOf(baseline, path),
    status: comparison.status,
    ...("reason" in comparison ? { reason: comparison.reason } : {}),
    ...("diff" in comparison && comparison.now !== undefined ? { now: comparison.now } : {}),
    ...("diff" in comparison ? { counts: comparison.diff.counts } : {}),
  };
}

/** A baseline that could not be compared or read, with why; or one left unchecked. */
export function plainEntry(stored: StoredBaseline, status: "unavailable" | "unchecked", reason?: string): Entry {
  return {
    ...("file" in stored
      ? headerOf(stored.file, stored.path)
      : {
          name: stored.name,
          path: stored.path,
        }),
    status,
    ...(reason === undefined ? {} : { reason }),
  };
}

function headerOf(baseline: BaselineFile, path: string): Omit<Entry, "status"> {
  return {
    name: baseline.name,
    path,
    node: baseline.node,
    file: baseline.file,
    page: baseline.page,
    capturedAt: baseline.capturedAt,
    code: baseline.code,
    ...(baseline.version === null ? {} : { version: baseline.version }),
  };
}
