import type { BaselineChanges, BaselineCounts, BaselineFile } from "@pixelwright/core";
import type * as z from "zod";
import type { BaselineEntrySchema } from "./schemas.ts";

type Entry = z.output<typeof BaselineEntrySchema>;

/** One baseline's summary: what changed since it was saved, or that it reads the same. */
export function changeSummary(baseline: BaselineFile, counts: BaselineCounts, changes: BaselineChanges): string {
  const head = `${baseline.name}: ${baseline.node.name} (${baseline.node.id})`;

  if (Object.values(counts).every((count) => count === 0)) {
    return `${head} reads as on ${utc(baseline.capturedAt)}.`;
  }

  const layers = [
    counted(counts.changed, "layer changed", "layers changed"),
    counted(counts.added, "added"),
    counted(counts.removed, "removed"),
    counted(counts.moved, "moved"),
    counted(counts.reordered, "reordered"),
  ].filter((part) => part !== "");
  const parts = [
    layers.join(", "),
    ...changes.components.map(
      (entry) => `${entry.component} ${verbOf(entry)} in ${entry.instances.length} of ${entry.of} instances`,
    ),
    counted(counts.tokens, "token changed", "tokens changed"),
  ].filter((part) => part !== "");

  return `${head} since ${utc(baseline.capturedAt)}: ${parts.join("; ")}.`;
}

/** Every baseline in a word: "3 baselines: pricing changed, checkout the same, pricing-mobile missing." */
export function overviewSummary(entries: readonly Entry[], more: number): string {
  if (entries.length === 0) {
    return "No baselines in this project yet: baseline_save keeps one right after the design_read you build from.";
  }

  const total = entries.length + more;

  return `${total} ${total === 1 ? "baseline" : "baselines"}: ${entries.map(({ name, status }) => `${name} ${status === "same" ? "the same" : status}`).join(", ")}${more > 0 ? `, and ${more} more` : ""}.`;
}

/** An ISO time as answers write it: 2026-10-14 09:12 UTC. */
export function utc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function verbOf(entry: BaselineChanges["components"][number]): string {
  if (entry.change !== "changed") {
    return entry.change;
  }

  return entry.drawing !== undefined && entry.attributes === undefined ? "redrawn" : "changed";
}

function counted(count: number, one: string, many = one): string {
  return count === 0 ? "" : `${count} ${count === 1 ? one : many}`;
}
