import { InjectionToken, injectable } from "@needle-di/core";
import { ACTION_NAME, ACTIONS_SHOWN, ACTIVITY_TEXT } from "@/plugin-ui/view/view.constants.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import { ACTIVITY_OUTCOME } from "@/shared/window/ui-message.constants.ts";
import type { ActivityEntry } from "@/shared/window/ui-message.schema.ts";

/**
 * What the AI did last (P-051): the last five answers main reported, newest first, a failure or a refusal as a
 * warning. No line selects a layer (D-50: native selection is the planned way to show work). It also keeps what the
 * notes around the switch need: a write was refused, and execute ran (P-012).
 */
@injectable()
export class RecentActions {
  #lines: readonly ActionLine[] = [];
  #refused = false;
  #ranCode = false;

  /** One op main answered, the window's time of hearing it. */
  add(entry: ActivityEntry, at: number): void {
    const refused = entry.outcome === ACTIVITY_OUTCOME.refused;

    this.#lines = [this.#line(entry, at), ...this.#lines].slice(0, ACTIONS_SHOWN);
    this.#refused ||= refused;
    this.#ranCode ||= entry.op === OP_NAME.execute && !refused;
  }

  lines(): readonly ActionLine[] {
    return this.#lines;
  }

  /** A write was refused while Allow edits was off, and the switch has not gone on since. */
  refused(): boolean {
    return this.#refused;
  }

  /** execute ran: code it started may run on after the switch goes off, until the window closes. */
  ranCode(): boolean {
    return this.#ranCode;
  }

  /** Allow edits went on: the refusal is answered. */
  forgetRefusal(): void {
    this.#refused = false;
  }

  #line({ op, outcome }: ActivityEntry, at: number): ActionLine {
    const name = ACTION_NAME[op] ?? op;

    switch (outcome) {
      case ACTIVITY_OUTCOME.refused:
        return { text: ACTIVITY_TEXT.refused, warning: true, at };
      case ACTIVITY_OUTCOME.failed:
        return { text: ACTIVITY_TEXT.failed(name), warning: true, at };
      default:
        return { text: name, warning: false, at };
    }
  }
}

export const RECENT_ACTIONS = new InjectionToken<RecentActions>("RecentActions");

/** One line of the activity: what was done, whether it went wrong, and when the window heard it (epoch ms). */
export interface ActionLine {
  readonly text: string;
  readonly warning: boolean;
  readonly at: number;
}
