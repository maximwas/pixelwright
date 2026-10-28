import { InjectionToken } from "@needle-di/core";
import type { StopReasons } from "@/plugin-ui/link/stop-reasons/stop-reasons.ts";

export const STOP_REASONS = new InjectionToken<StopReasons>("StopReasons");
