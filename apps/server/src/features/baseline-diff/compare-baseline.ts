import { type BaselineDiff, type BaselineFile, baselineDiff, type PluginInfo } from "@pixelwright/core";
import { baselineTarget } from "../../baselines/baseline-target.ts";
import { type Capture, captureLayer, HiddenLayerError } from "../../baselines/capture.ts";
import { locateRoot } from "../../baselines/locate-root.ts";
import { MAX_DIFF_ENTRIES } from "../../constants/mcp.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import type { BridgeView } from "../../types/mcp.ts";

/** What comparing a baseline needs: the plugin, and the bridge's connected files. */
export interface CompareContext {
  readonly plugin: PluginClient;
  readonly bridge: BridgeView;
}

/** A baseline against the design now: compared, or why it could not be. */
export type Comparison =
  | {
      readonly status: "missing" | "hidden" | "unavailable";
      readonly reason: string;
      readonly notes: string[];
    }
  | {
      readonly status: "same" | "changed";
      readonly diff: BaselineDiff;
      readonly capture: Capture;
      readonly info: PluginInfo | undefined;
      readonly now?: { id: string; name: string };
      readonly notes: string[];
    };

/**
 * A baseline compared in the file it came from (or `file`), with its own layer (or `node`, or the one found again by
 * name): read the way it was saved and compared by core. A file that cannot be found is an error; a gone, hidden or
 * other layer is a status.
 */
export async function compareBaseline(
  context: CompareContext,
  baseline: BaselineFile,
  { node, file }: { node?: string | undefined; file?: string | undefined },
): Promise<Comparison> {
  const target = baselineTarget(context.bridge.plugins(), baseline, file);
  const session = context.plugin.session(target.session);
  const root = await locateRoot(session, baseline, node);

  if (root.status !== "found") {
    return {
      status: root.status,
      reason: root.reason,
      notes: target.notes,
    };
  }

  const capture = await visibleCapture(session, root.id);

  if ("reason" in capture) {
    return {
      ...capture,
      notes: target.notes,
    };
  }

  const sameReader = baseline.by.plugin === capture.plugin;
  const diff = diffOf(baseline, capture, sameReader);
  const now =
    node === undefined
      ? root.now
      : {
          id: capture.snapshot.root.id,
          name: capture.snapshot.root.name,
        };

  return {
    status: diff.same ? "same" : "changed",
    diff,
    capture,
    info: session.info(),
    ...(now === undefined ? {} : { now }),
    notes: [
      ...target.notes,
      ...root.notes,
      ...capture.notes,
      ...diff.notes,
      ...readerNote(baseline, capture, sameReader),
    ],
  };
}

/** The baseline against the read now, each list cut to the server's cap. */
function diffOf(baseline: BaselineFile, capture: Capture, sameReader: boolean): BaselineDiff {
  return baselineDiff(
    {
      snapshot: baseline.snapshot,
      tokens: baseline.tokens,
    },
    {
      snapshot: capture.snapshot,
      tokens: capture.tokens,
    },
    {
      sameReader,
      cap: MAX_DIFF_ENTRIES,
    },
  );
}

/** The layer read for the comparison; a hidden one is a status, not an error. */
async function visibleCapture(
  session: PluginSession,
  id: string,
): Promise<Capture | { status: "hidden"; reason: string }> {
  try {
    return await captureLayer(session, id);
  } catch (error) {
    if (error instanceof HiddenLayerError) {
      return {
        status: "hidden",
        reason: error.message,
      };
    }

    throw error;
  }
}

/** When two plugin versions read the two sides, a change may come from the reading, not the design. */
function readerNote(baseline: BaselineFile, capture: Capture, sameReader: boolean): string[] {
  return sameReader
    ? []
    : [
        `Read by plugin ${baseline.by.plugin ?? "unknown"}, now ${capture.plugin ?? "unknown"}: a change that comes from the newer reading goes away when you accept.`,
      ];
}
