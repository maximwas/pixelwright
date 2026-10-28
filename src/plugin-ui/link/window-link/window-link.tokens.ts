import { InjectionToken } from "@needle-di/core";
import type { WindowLink } from "@/plugin-ui/link/window-link/window-link.ts";

export const WINDOW_LINK = new InjectionToken<WindowLink>("WindowLink");
