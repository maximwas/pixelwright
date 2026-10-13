import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { CHANGES_MAX, OWN_WRITE_ECHO_MS } from "../constants/plugin.ts";

type Change = OperationOutput<"changes">["changes"][number];
type Entry = Change & { seq: number };

/** The journal, oldest first: one entry per layer and hand, a layer's run of changes by one hand merged into it. */
const entries = new Map<string, Entry>();
/** Cursors count from the start time, so a cursor from before the plugin started again is told apart. */
let start = 0;
let seq = 0;
let dropped = 0;
/** The latest cursor an answer gave: entries up to it may have been read. */
let served = 0;
let since = new Date().toISOString();
let watched: PageNode | null = null;
let writing = 0;
let echoUntil = 0;

/** Starts journalling the current page's changes, and follows the user to every page they switch to. */
export function startChangeJournal(): void {
  entries.clear();
  start = Math.max(Date.now() * 1_000, seq + 1);
  seq = start;
  dropped = start;
  served = start;
  echoUntil = 0;
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
export async function changes({
  since: after = start,
}: OperationInput<"changes">): Promise<OperationOutput<"changes">> {
  // A cursor from another run of the plugin (or none it gave) cannot be followed: everything this run knows comes back.
  const foreign = after < start || after > seq;

  served = seq;

  return {
    cursor: seq,
    since,
    truncated: foreign || after < dropped,
    changes: [...entries.values()]
      .filter((entry) => entry.seq > (foreign ? start : after))
      .map(({ seq: _seq, ...change }) => change),
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
    const key = `${change.id} ${by}`;
    const last = entries.get(key);
    const node = change.node as Partial<SceneNode> & { removed?: boolean };
    const properties = "properties" in change ? [...change.properties] : [];

    if (last !== undefined && kind === "deleted" && last.change === "created" && last.seq > served) {
      // Made and taken away by one hand before anyone read of it: nothing is left to tell.
      entries.delete(key);
      continue;
    }

    const merged = last !== undefined && kind === "changed";

    entries.delete(key);
    seq += 1;
    entries.set(key, {
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
    entries.delete(`${oldest.id} ${oldest.by}`);
  }
}
