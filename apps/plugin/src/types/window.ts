import type { LinkState } from "./link.ts";
import type { PluginContext } from "./messages.ts";

/** A line of the window's activity: what a request did, in plain words. */
export interface ActionLine {
  readonly text: string;
  /** Refused or failed: shown so the user notices. */
  readonly warning: boolean;
  /** A write refused because Allow edits is off. */
  readonly refused: boolean;
}

export interface RecentAction {
  readonly text: string;
  readonly at: number;
  readonly warning: boolean;
}

export interface WindowState {
  readonly context: PluginContext;
  readonly link: LinkState;
  readonly actions: readonly RecentAction[];
  /** A write came while Allow edits was off: the window asks for it until it is on. */
  readonly refused: boolean;
  /** execute ran in this window: what its code started may still run. */
  readonly ranCode: boolean;
}
