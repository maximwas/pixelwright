import { BASELINE_FORMAT, type BaselineFile, type PluginInfo, type SnapshotNode } from "@pixelwright/core";
import type * as z from "zod";
import type { Capture } from "../../baselines/capture.ts";
import type { BaselineSaveOutputSchema } from "./schemas.ts";

type Output = z.output<typeof BaselineSaveOutputSchema>;

/** A baseline of a layer just read: its header, then the read and its tokens. */
export function baselineOf(
  name: string,
  capture: Capture,
  { code, info, server }: { code: string[]; info: PluginInfo | undefined; server: string },
): BaselineFile {
  const { root } = capture.snapshot;

  return {
    pixelwrightBaseline: BASELINE_FORMAT,
    name,
    capturedAt: capture.capturedAt,
    by: {
      server,
      plugin: capture.plugin,
    },
    file: info?.file ?? {
      name: "",
      key: null,
    },
    page: capture.snapshot.page ?? null,
    node: {
      id: root.id,
      name: root.name,
      type: root.type,
    },
    code,
    version: null,
    snapshot: capture.snapshot,
    tokens: capture.tokens,
  };
}

/** What baseline_save answers about a baseline it wrote. */
export function answerOf(
  file: BaselineFile,
  path: string,
  { notes, replaced }: { notes: string[]; replaced?: Output["replaced"] },
): Output {
  const cut = cutOf(file.snapshot.root);

  return {
    name: file.name,
    path,
    node: file.node,
    file: file.file,
    page: file.page,
    capturedAt: file.capturedAt,
    code: file.code,
    layers: layersOf(file.snapshot.root),
    tokens: tokensOf(file),
    cut,
    ...(replaced === undefined ? {} : { replaced }),
    notes: [
      ...notes,
      ...(cut.length === 0
        ? []
        : ["Save these branches as baselines of their own: baseline_diff does not compare inside them."]),
    ],
  };
}

/** The shown layers whose read lacks some of their children: the snapshot's budget cut them. */
function cutOf(node: SnapshotNode): Output["cut"] {
  if (!node.visible) {
    return [];
  }

  const own =
    (node.children?.length ?? 0) < node.childCount
      ? [
          {
            id: node.id,
            name: node.name,
            children: node.childCount,
          },
        ]
      : [];

  return [...own, ...(node.children ?? []).flatMap(cutOf)];
}

function layersOf(node: SnapshotNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + layersOf(child), 0);
}

/** The variables and styles a baseline keeps values of. */
function tokensOf({ tokens, snapshot }: BaselineFile): number {
  return tokens === null
    ? Object.keys(snapshot.variables).length + Object.keys(snapshot.styles).length
    : tokens.variables.length + Object.keys(tokens.external).length + tokens.styles.length;
}
