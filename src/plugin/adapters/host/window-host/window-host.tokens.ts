import { InjectionToken } from "@needle-di/core";
import type { WindowHost } from "@/plugin/adapters/host/window-host/window-host.ts";

export const WINDOW_HOST = new InjectionToken<WindowHost>("WindowHost");
