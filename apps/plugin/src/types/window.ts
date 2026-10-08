import type { LinkState } from "./link.ts";
import type { PluginContext } from "./messages.ts";

export interface RecentAction {
  readonly op: string;
  readonly at: number;
}

export interface WindowState {
  readonly context: PluginContext;
  readonly link: LinkState;
  readonly actions: readonly RecentAction[];
}
