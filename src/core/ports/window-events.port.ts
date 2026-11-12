import { InjectionToken } from "@needle-di/core";
import type { ActivityEntry, BusyOp } from "@/shared/window/ui-message.schema.ts";

/** What main shows in its window as it happens (P-051, D-06): events, sent at once, never answered. */
export interface WindowEvents {
  /** An op answered: the window lists it. */
  activity(entry: ActivityEntry): void;
  /** Every op still running after its answer (the watchdog's TIMEOUT, execute's code past its time); [] once none is. */
  busy(ops: readonly BusyOp[]): void;
}

export const WINDOW_EVENTS = new InjectionToken<WindowEvents>("WindowEvents");
