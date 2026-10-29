import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { DOCUMENT_EVENTS, type NodeChangeRecord } from "@/core/ports/document-events.port.ts";
import { JOURNAL } from "@/plugin/app/journal/journal.constants.ts";
import { CHANGE_BY, CHANGE_KIND } from "@/shared/ops/changes/changes.constants.ts";
import type { Change, changesOp } from "@/shared/ops/changes/changes.manifest.ts";

type ChangesOutput = zod.output<typeof changesOp.output>;

/** A change Figma reported, when, and whether it was Pixelwright's then. */
interface Heard {
  readonly change: NodeChangeRecord;
  readonly at: string;
  readonly own: boolean;
}

type Entry = Change & { readonly seq: number };

/**
 * What changed in the file while the plugin runs, for changes_since (T-035): one entry per layer and hand, oldest
 * first, a layer's run of changes by one hand merged into it. Pixelwright's own are told by ids, never by time alone
 * (D-53): a write's touched layers, and for execute, which returns none, what Figma reports while its code runs and a
 * moment after (A§15.9). While a write runs its reports wait, so its touched ids decide them when it ends (P-022).
 */
@injectable()
export class ChangeJournal {
  readonly #events;
  readonly #clock;
  readonly #entries = new Map<string, Entry>();
  /** A touched layer's id, and until when its next report is Pixelwright's. */
  readonly #own = new Map<string, number>();
  #held: Heard[] = [];
  #writes = 0;
  #executing = 0;
  #echoUntil = 0;
  #start = 0;
  #seq = 0;
  #dropped = 0;
  /** The latest cursor an answer gave: entries up to it may have been read. */
  #served = 0;
  #since = "";

  constructor(events = inject(DOCUMENT_EVENTS), clock = inject(CLOCK)) {
    this.#events = events;
    this.#clock = clock;
  }

  /** Starts journalling the current page's changes, following the user to every page they switch to. */
  start(): void {
    const now = this.#clock.now();

    this.#start = Math.max(now * JOURNAL.cursorPerMs, this.#seq + 1);
    this.#seq = this.#start;
    this.#dropped = this.#start;
    this.#served = this.#start;
    this.#since = new Date(now).toISOString();
    this.#events.onNodeChanges((changes) => this.#heard(changes));
  }

  /** A write starts; the function it gets ends it with the ids it touched, which make their changes its own. */
  writing(): (touched: readonly string[]) => void {
    this.#writes += 1;

    return (touched) => {
      const now = this.#clock.now();

      for (const [id, until] of this.#own) {
        if (until <= now) {
          this.#own.delete(id);
        }
      }

      for (const id of touched) {
        this.#own.set(id, now + JOURNAL.ownEchoMs);
      }

      this.#writes -= 1;

      if (this.#writes === 0) {
        const held = this.#held;

        this.#held = [];
        this.#keep(held.map((heard) => ({ ...heard, own: heard.own || this.#ownNow(heard.change.id) })));
      }
    };
  }

  /**
   * execute's code starts running; the function it gets says the code ended, however long after its answer, its echo
   * counted a moment longer.
   */
  executing(): () => void {
    this.#executing += 1;

    return () => {
      this.#executing -= 1;
      this.#echoUntil = this.#clock.now() + JOURNAL.executeEchoMs;
    };
  }

  /** What changed after `after` (a cursor from an earlier answer), with the cursor to ask from next time. */
  changes(after = this.#start): ChangesOutput {
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

  #heard(changes: readonly NodeChangeRecord[]): void {
    const at = new Date(this.#clock.now()).toISOString();
    const heard = changes.map((change) => ({ change, at, own: this.#ownNow(change.id) }));

    if (this.#writes > 0) {
      this.#held.push(...heard);
    } else {
      this.#keep(heard);
    }
  }

  #ownNow(id: string): boolean {
    const now = this.#clock.now();

    return this.#executing > 0 || now < this.#echoUntil || (this.#own.get(id) ?? 0) > now;
  }

  /** Records what was heard; a touched layer's report is its write's once, so a later edit of it is the user's. */
  #keep(heard: readonly Heard[]): void {
    for (const each of heard) {
      this.#record(each);
      this.#own.delete(each.change.id);
    }

    this.#trim();
  }

  #record({ change, at, own }: Heard): void {
    const by = change.remote ? CHANGE_BY.collaborator : own ? CHANGE_BY.pixelwright : CHANGE_BY.user;
    const key = JOURNAL.key(change.id, by);
    const last = this.#entries.get(key);

    if (last?.change === CHANGE_KIND.created && change.change === CHANGE_KIND.deleted && last.seq > this.#served) {
      // Made and taken away by one hand before anyone read of it: nothing is left to tell.
      this.#entries.delete(key);

      return;
    }

    const merged = last !== undefined && change.change === CHANGE_KIND.changed;

    this.#entries.delete(key);
    this.#seq += 1;
    this.#entries.set(key, {
      seq: this.#seq,
      id: change.id,
      name: change.name ?? last?.name ?? "",
      type: change.type,
      change: merged ? last.change : change.change,
      properties: merged ? [...new Set([...last.properties, ...change.properties])] : [...change.properties],
      by,
      page: change.page,
      at,
    });
  }

  /** Past the journal's size the oldest entries go, and a cursor from before them is told it missed some. */
  #trim(): void {
    for (const [key, oldest] of this.#entries) {
      if (this.#entries.size <= JOURNAL.maxEntries) {
        return;
      }

      this.#dropped = oldest.seq;
      this.#entries.delete(key);
    }
  }
}

export const CHANGE_JOURNAL = new InjectionToken<ChangeJournal>("ChangeJournal");
