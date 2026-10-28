import { InjectionToken } from "@needle-di/core";
import type { Backoff } from "@/plugin-ui/link/backoff/backoff.ts";

export const BACKOFF = new InjectionToken<Backoff>("Backoff");
