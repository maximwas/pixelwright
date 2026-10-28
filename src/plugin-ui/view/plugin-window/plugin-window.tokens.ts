import { InjectionToken } from "@needle-di/core";
import type { PluginWindow } from "@/plugin-ui/view/plugin-window/plugin-window.ts";

export const PLUGIN_WINDOW = new InjectionToken<PluginWindow>("PluginWindow");
