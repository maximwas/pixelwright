import { injectable } from "@needle-di/core";
import type { Clock } from "../../../core/ports/clock.port.ts";

@injectable()
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
