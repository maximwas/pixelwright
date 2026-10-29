import { InjectionToken } from "@needle-di/core";
import type { ActivityEntry, BusyOp } from "@/shared/window/ui-message.schema.ts";

/** What main shows in its window as it happens (P-051, D-06): events, sent at once, never answered. */
export interface WindowEvents {
  /** An op answered: the window lists it. */
  activity(entry: ActivityEntry): void;
  /** Every op whose handler still runs after the watchdog answered for it; an empty list once none does. */
  busy(ops: readonly BusyOp[]): void;
}

export const WINDOW_EVENTS = new InjectionToken<WindowEvents>("WindowEvents");
