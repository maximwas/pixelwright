import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { CHANGES_MAX, OWN_WRITE_ECHO_MS } from "../constants/plugin.ts";

type Change = OperationOutput<"changes">["changes"][number];
type Entry = Change & { seq: number };

/** The journal: the latest entry per layer, oldest first; a layer's run of changes by one hand is one entry. */
const entries = new Map<string, Entry>();
let seq = 0;
let dropped = 0;
let since = new Date().toISOString();
let watched: PageNode | null = null;
let writing = 0;
let echoUntil = 0;

/** Starts journalling the current page's changes, and follows the user to every page they switch to. */
export function startChangeJournal(): void {
  entries.clear();
  seq = 0;
  dropped = 0;
  since = new Date().toISOString();
  watch(figma.currentPage);
  figma.on("currentpagechange", () => watch(figma.currentPage));
}

/** Pixelwright is writing (or has just written): the changes Figma reports now are its own. */
export function noteOwnWrite(): void {
  echoUntil = Date.now() + OWN_WRITE_ECHO_MS;
}

/** Runs one of Pixelwright's writes, its changes marked as its own until a moment after it ends. */
export async function asOwnWrite<T>(write: () => Promise<T>): Promise<T> {
  writing += 1;

  try {
    return await write();
  } finally {
    writing -= 1;
    noteOwnWrite();
  }
}

/** What changed after `since` (a cursor from an earlier answer), with the cursor to ask from next time. */
export async function changes({ since: after = 0 }: OperationInput<"changes">): Promise<OperationOutput<"changes">> {
  return {
    cursor: seq,
    since,
    truncated: after < dropped,
    changes: [...entries.values()].filter((entry) => entry.seq > after).map(({ seq: _seq, ...change }) => change),
  };
}

function watch(page: PageNode): void {
  if (watched === page) {
    return;
  }

  watched?.off("nodechange", onChange);
  watched = page;
  page.on("nodechange", onChange);
}

function onChange(event: NodeChangeEvent): void {
  const own = writing > 0 || Date.now() < echoUntil;

  for (const change of event.nodeChanges) {
    const by: Change["by"] = change.origin === "REMOTE" ? "collaborator" : own ? "pixelwright" : "user";
    const kind: Change["change"] =
      change.type === "CREATE" ? "created" : change.type === "DELETE" ? "deleted" : "changed";
    const last = entries.get(change.id);
    const node = change.node as Partial<SceneNode> & { removed?: boolean };
    const properties = "properties" in change ? [...change.properties] : [];

    if (last !== undefined && last.by === by && kind === "deleted" && last.change === "created") {
      // Made and taken away by one hand: nothing is left to tell.
      entries.delete(change.id);
      continue;
    }

    const merged = last !== undefined && last.by === by && kind === "changed";

    entries.delete(change.id);
    seq += 1;
    entries.set(change.id, {
      seq,
      id: change.id,
      name: (node.removed ? undefined : node.name) ?? last?.name ?? "",
      type: (node.removed ? undefined : node.type) ?? last?.type ?? "",
      change: merged ? last.change : kind,
      properties: merged ? [...new Set([...last.properties, ...properties])] : properties,
      by,
      page: watched?.name ?? "",
      at: new Date().toISOString(),
    });
  }

  while (entries.size > CHANGES_MAX) {
    const [oldest] = entries.values();

    if (oldest === undefined) {
      break;
    }

    dropped = oldest.seq;
    entries.delete(oldest.id);
  }
}
