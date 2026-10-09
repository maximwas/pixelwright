import { SILENT_OPERATIONS } from "@pixelwright/core";
import { RECENT_ACTIONS } from "../constants/plugin.ts";
import type { RecentAction } from "../types/window.ts";

/** The window's last actions with this one first; probes such as status's ping leave the list as it is. */
export function withAction(actions: readonly RecentAction[], op: string, at: number): readonly RecentAction[] {
  if (SILENT_OPERATIONS.has(op)) {
    return actions;
  }

  return [
    {
      op,
      at,
    },
    ...actions,
  ].slice(0, RECENT_ACTIONS);
}
