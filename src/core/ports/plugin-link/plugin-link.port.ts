import { InjectionToken } from "@needle-di/core";
import type { PLUGIN_LINK_ROLES } from "./plugin-link.constants.ts";

export type PluginLinkRole = (typeof PLUGIN_LINK_ROLES)[number];

/** While an unpaired plugin waits: the code the user types into its window, or how long pairing is paused. */
export interface PairingStatus {
  /** null while pairing is paused after too many wrong codes. */
  readonly code: string | null;
  readonly expiresInSeconds: number | null;
  readonly lockedForSeconds: number | null;
  /** Unpaired plugin windows waiting for the code. */
  readonly waiting: number;
}

/** Where this server stands with the Figma plugins, as status shows it. */
export interface PluginLinkState {
  readonly role: PluginLinkRole;
  readonly port: number;
  /** Asking for the state is what mints a pairing code while a plugin waits (S-020): only status asks. */
  readonly pairing: PairingStatus | null;
  /** What the user should do; null when a file is connected and nothing is wrong. */
  readonly hint: string | null;
}

/** This server's way to the Figma plugins. Ops arrive with the bridge (items 03-05); status reads the state now. */
export interface PluginLink {
  /** Takes the bridge up; a bridge that cannot start says why in its state instead of throwing. */
  start(): Promise<void>;
  /** Frees the port first, so another server can take it at once (S-013). */
  close(): Promise<void>;
  state(): PluginLinkState;
}

export const PLUGIN_LINK = new InjectionToken<PluginLink>("PluginLink");
