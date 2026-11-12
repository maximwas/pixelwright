import { InjectionToken } from "@needle-di/core";

/** The window's Allow edits switch for this file (P-010, P-011): off by default; the plugin refuses writes while off. */
export interface EditsSwitch {
  isOn(): Promise<boolean>;
  /** Kept per file; a save Figma refuses (a view-only file) holds for this run only. */
  set(on: boolean): Promise<void>;
}

export const EDITS_SWITCH = new InjectionToken<EditsSwitch>("EditsSwitch");
