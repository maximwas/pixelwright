import { BridgeError } from "@pixelwright/core";
import type * as z from "zod";
import type { BaselineStore } from "../../baselines/baseline-store.ts";
import type { SeenDesigns } from "../../baselines/seen-designs.ts";
import { entryOf } from "./baseline-entry.ts";
import { type CompareContext, compareBaseline } from "./compare-baseline.ts";
import type { BaselineDiffOutputSchema } from "./schemas.ts";
import { changeSummary } from "./summary.ts";

type Output = z.output<typeof BaselineDiffOutputSchema>;

/** What a one-baseline diff needs besides the plugin: the project's baselines and the cache accepts come from. */
export interface DiffContext extends CompareContext {
  readonly baselines: BaselineStore;
  readonly seen: SeenDesigns;
}

/**
 * One baseline against the design now, change by change; the compared state is kept under the answer's accept, so
 * baseline_save keeps exactly what was reviewed.
 */
export async function diffOne(
  context: DiffContext,
  { name, node, file }: { name: string; node?: string | undefined; file?: string | undefined },
): Promise<Output> {
  const baseline = await context.baselines.read(name);

  if (baseline === null) {
    const names = (await context.baselines.list()).map((stored) => stored.name);

    throw new BridgeError(
      "OP_FAILED",
      `No baseline named ${name} in this project${names.length === 0 ? "" : ` (it has ${names.join(", ")})`}: baseline_save keeps one.`,
    );
  }

  const path = context.baselines.pathOf(name);
  const comparison = await compareBaseline(context, baseline, {
    node,
    file,
  });

  if (!("diff" in comparison)) {
    return {
      summary: `${name}: ${comparison.reason}`,
      baselines: [entryOf(baseline, path, comparison)],
      notes: comparison.notes,
    };
  }

  const { diff, capture } = comparison;
  const root = capture.snapshot.root;
  const accept = context.seen.keep({
    name,
    node: {
      id: root.id,
      name: root.name,
      type: root.type,
    },
    file: comparison.info?.file ?? baseline.file,
    page: capture.snapshot.page ?? baseline.page,
    plugin: capture.plugin,
    snapshot: capture.snapshot,
    tokens: capture.tokens,
    capturedAt: capture.capturedAt,
    baselineCapturedAt: baseline.capturedAt,
  });

  return {
    summary: changeSummary(baseline, diff.counts, diff.changes),
    baselines: [entryOf(baseline, path, comparison)],
    changes: diff.changes,
    accept,
    ...(diff.more === 0 ? {} : { more: diff.more }),
    notes: comparison.notes,
  };
}
