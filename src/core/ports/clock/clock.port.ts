import { InjectionToken } from "@needle-di/core";

/** Time in milliseconds since the epoch; a port, so timing is testable. */
export interface Clock {
  now(): number;
}

export const CLOCK = new InjectionToken<Clock>("Clock");
