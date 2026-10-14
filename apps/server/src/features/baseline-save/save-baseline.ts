import { type BaselineFile, BridgeError, baselineDiff, slug } from "@pixelwright/core";
import type * as z from "zod";
import type { BaselineStore } from "../../baselines/baseline-store.ts";
import { type Capture, captureLayer } from "../../baselines/capture.ts";
import type { SeenDesigns } from "../../baselines/seen-designs.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { selectedLayer } from "../../plugin/selected-layer.ts";
import { answerOf, baselineOf } from "./baseline-answer.ts";
import { codePaths } from "./code-paths.ts";
import type { BaselineSaveInputSchema, BaselineSaveOutputSchema } from "./schemas.ts";

type Args = z.output<typeof BaselineSaveInputSchema>;
type Output = z.output<typeof BaselineSaveOutputSchema>;

/** What a save needs: the plugin, the project's baselines and the designs diffs compared, the project, the server. */
export interface SaveContext {
  readonly plugin: PluginClient;
  readonly baselines: BaselineStore;
  readonly seen: SeenDesigns;
  readonly projectRoot: string;
  readonly version: string;
}

/**
 * Keeps a baseline: a layer read now (a new name, or `replace`), the design a diff compared (`accept`), or only a new
 * file list (`code` alone). An existing name is never replaced without one of them.
 */
export async function saveBaseline(context: SaveContext, args: Args): Promise<Output> {
  context.baselines.folder();

  const code = args.code === undefined ? undefined : codePaths(args.code, context.projectRoot);

  if (args.accept !== undefined) {
    return acceptDiff(context, args, code);
  }

  const existing = args.name === undefined ? null : await existingOf(context.baselines, args.name, args.replace);
  const onlyCode = code !== undefined && args.node === undefined && !args.replace && args.file === undefined;

  if (existing !== null && onlyCode) {
    return written(
      context,
      {
        ...existing,
        code: code.paths,
      },
      code.notes,
    );
  }

  return saveRead(context, args, code);
}

/** The layer read now and kept; a name already kept is refused unless replace starts it over. */
async function saveRead(
  context: SaveContext,
  args: Args,
  code: { paths: string[]; notes: string[] } | undefined,
): Promise<Output> {
  const session = context.plugin.session(args.file);
  const capture = await captureLayer(session, args.node ?? (await selectedLayer(session, "NODE_NOT_FOUND")));
  const name = args.name ?? slug(capture.snapshot.root.name);
  const existing = await existingOf(context.baselines, name, args.replace);

  if (existing !== null && !args.replace) {
    throw new BridgeError(
      "OP_FAILED",
      `${name} exists (${existing.node.name}, ${existing.node.id}, saved ${utc(existing.capturedAt)}): pass the accept a baseline_diff gave, replace: true to start over, code alone to change its files, or another name.`,
    );
  }

  const file = baselineOf(name, capture, {
    code: code?.paths ?? existing?.code ?? [],
    info: session.info(),
    server: context.version,
  });

  return written(context, file, [...(code?.notes ?? []), ...capture.notes], replacedBy(existing, capture));
}

/** The design a diff compared, kept as it was compared: nothing is read. */
async function acceptDiff(
  context: SaveContext,
  args: Args,
  code: { paths: string[]; notes: string[] } | undefined,
): Promise<Output> {
  if (args.name === undefined || args.node !== undefined || args.replace || args.file !== undefined) {
    throw new BridgeError(
      "OP_FAILED",
      "accept keeps the design a baseline_diff compared: give the baseline's name with it (and code, to change its files), nothing else.",
    );
  }

  const seen = context.seen.get(args.accept ?? "");

  if (seen === undefined || seen.name !== args.name) {
    throw new BridgeError("OP_FAILED", "That diff is no longer held (the server restarted): run baseline_diff again.");
  }

  const stored = await context.baselines.read(args.name);

  if (stored === null || stored.capturedAt !== seen.baselineCapturedAt) {
    throw new BridgeError("OP_FAILED", `${args.name} was saved again since that diff: run baseline_diff again.`);
  }

  return written(
    context,
    {
      ...stored,
      capturedAt: seen.capturedAt,
      by: {
        server: context.version,
        plugin: seen.plugin,
      },
      file: seen.file,
      page: seen.page,
      node: seen.node,
      code: code?.paths ?? stored.code,
      version: null,
      snapshot: seen.snapshot,
      tokens: seen.tokens,
    },
    [
      ...(code?.notes ?? []),
      ...(stored.version === null
        ? []
        : [`The version "${stored.version.title}" held the design before this one: it is no longer recorded here.`]),
    ],
  );
}

/** The baseline kept under a name; an unreadable one counts as none when replace starts it over. */
async function existingOf(store: BaselineStore, name: string, replace: boolean): Promise<BaselineFile | null> {
  try {
    return await store.read(name);
  } catch (error) {
    if (replace) {
      return null;
    }

    throw error;
  }
}

/** What a replaced baseline kept, and how much the new read took in. */
function replacedBy(existing: BaselineFile | null, capture: Capture): Output["replaced"] {
  if (existing === null) {
    return undefined;
  }

  const { counts } = baselineDiff(
    {
      snapshot: existing.snapshot,
      tokens: existing.tokens,
    },
    {
      snapshot: capture.snapshot,
      tokens: capture.tokens,
    },
    { sameReader: existing.by.plugin === capture.plugin },
  );

  return {
    node: {
      id: existing.node.id,
      name: existing.node.name,
    },
    capturedAt: existing.capturedAt,
    counts,
  };
}

async function written(
  context: SaveContext,
  file: BaselineFile,
  notes: string[],
  replaced?: Output["replaced"],
): Promise<Output> {
  const { path, madeFolder } = await context.baselines.write(file);
  const made = madeFolder
    ? [
        `Made .pixelwright/baselines in ${context.projectRoot}: commit it to share baselines with the team, or leave it out of git: it holds the design's texts.`,
      ]
    : [];

  return answerOf(file, path, {
    notes: [...made, ...notes],
    ...(replaced === undefined ? {} : { replaced }),
  });
}

/** An ISO time as the answers write it: 2026-10-14 09:12 UTC. */
function utc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
