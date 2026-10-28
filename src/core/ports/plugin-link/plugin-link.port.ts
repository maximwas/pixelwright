import { InjectionToken } from "@needle-di/core";
import type { PLUGIN_LINK_ROLES } from "./plugin-link.constants.ts";

/** Where this server stands with the Figma plugins, as status shows it. */
export interface PluginLinkState {
  readonly role: (typeof PLUGIN_LINK_ROLES)[number];
  readonly port: number;
  /** What the user should do; null when a file is connected and nothing is wrong. */
  readonly hint: string | null;
}

/** This server's way to the Figma plugins. Ops arrive with the bridge (items 02-05); status reads the state now. */
export interface PluginLink {
  state(): PluginLinkState;
}

export const PLUGIN_LINK = new InjectionToken<PluginLink>("PluginLink");
