import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { CHANGES_MAX, OWN_WRITE_ECHO_MS } from "../constants/plugin.ts";

type Change = OperationOutput<"changes">["changes"][number];
type Entry = Change & { seq: number };

/**
 * What changed in the file while the plugin runs, for changes_since: one entry per layer and hand, oldest first, a
 * layer's run of changes by one hand merged into it. Cursors count from the start time, so a cursor from before the
 * plugin started again is told apart.
 */
export class ChangeJournal {
  readonly #entries = new Map<string, Entry>();
  #start = 0;
  #seq = 0;
  #dropped = 0;
  /** The latest cursor an answer gave: entries up to it may have been read. */
  #served = 0;
  #since = new Date().toISOString();
  #watched: PageNode | null = null;
  #writing = 0;
  #echoUntil = 0;

  /** Starts journalling the current page's changes, and follows the user to every page they switch to. */
  start(): void {
    this.#entries.clear();
    this.#start = Math.max(Date.now() * 1_000, this.#seq + 1);
    this.#seq = this.#start;
    this.#dropped = this.#start;
    this.#served = this.#start;
    this.#echoUntil = 0;
    this.#since = new Date().toISOString();
    this.#watch(figma.currentPage);
    figma.on("currentpagechange", () => this.#watch(figma.currentPage));
  }

  /** Pixelwright is writing (or has just written): the changes Figma reports now are its own. */
  noteOwnWrite(): void {
    this.#echoUntil = Date.now() + OWN_WRITE_ECHO_MS;
  }

  /** Runs one of Pixelwright's writes, its changes marked as its own until a moment after it ends. */
  async asOwnWrite<T>(write: () => Promise<T>): Promise<T> {
    this.#writing += 1;

    try {
      return await write();
    } finally {
      this.#writing -= 1;
      this.noteOwnWrite();
    }
  }

  /** What changed after `since` (a cursor from an earlier answer), with the cursor to ask from next time. */
  changes({ since: after = this.#start }: OperationInput<"changes">): OperationOutput<"changes"> {
    // A cursor from another run of the plugin (or none it gave) cannot be followed: everything this run knows comes back.
    const foreign = after < this.#start || after > this.#seq;

    this.#served = this.#seq;

    return {
      cursor: this.#seq,
      since: this.#since,
      truncated: foreign || after < this.#dropped,
      changes: [...this.#entries.values()]
        .filter((entry) => entry.seq > (foreign ? this.#start : after))
        .map(({ seq: _seq, ...change }) => change),
    };
  }

  #watch(page: PageNode): void {
    if (this.#watched === page) {
      return;
    }

    this.#watched?.off("nodechange", this.#onChange);
    this.#watched = page;
    page.on("nodechange", this.#onChange);
  }

  readonly #onChange = (event: NodeChangeEvent): void => {
    const own = this.#writing > 0 || Date.now() < this.#echoUntil;

    for (const change of event.nodeChanges) {
      this.#record(change, byOf(change, own));
    }

    this.#trim();
  };

  #record(change: NodeChange, by: Change["by"]): void {
    const kind: Change["change"] =
      change.type === "CREATE" ? "created" : change.type === "DELETE" ? "deleted" : "changed";
    const key = `${change.id} ${by}`;
    const last = this.#entries.get(key);

    if (last !== undefined && kind === "deleted" && last.change === "created" && last.seq > this.#served) {
      // Made and taken away by one hand before anyone read of it: nothing is left to tell.
      this.#entries.delete(key);

      return;
    }

    const node = change.node as Partial<SceneNode> & { removed?: boolean };
    const properties = "properties" in change ? [...change.properties] : [];
    const merged = last !== undefined && kind === "changed";

    this.#entries.delete(key);
    this.#seq += 1;
    this.#entries.set(key, {
      seq: this.#seq,
      id: change.id,
      name: (node.removed ? undefined : node.name) ?? last?.name ?? "",
      type: (node.removed ? undefined : node.type) ?? last?.type ?? "",
      change: merged ? last.change : kind,
      properties: merged ? [...new Set([...last.properties, ...properties])] : properties,
      by,
      page: this.#watched?.name ?? "",
      at: new Date().toISOString(),
    });
  }

  /** Past the journal's size the oldest entries go, and a cursor from before them is told it missed some. */
  #trim(): void {
    while (this.#entries.size > CHANGES_MAX) {
      const [oldest] = this.#entries.values();

      if (oldest === undefined) {
        break;
      }

      this.#dropped = oldest.seq;
      this.#entries.delete(`${oldest.id} ${oldest.by}`);
    }
  }
}

/** Whose change this is: a collaborator's, Pixelwright's while it writes, else the user's. */
function byOf(change: NodeChange, own: boolean): Change["by"] {
  if (change.origin === "REMOTE") {
    return "collaborator";
  }

  return own ? "pixelwright" : "user";
}
