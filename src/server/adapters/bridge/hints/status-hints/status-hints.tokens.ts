import { InjectionToken } from "@needle-di/core";
import type { StatusHints } from "@/server/adapters/bridge/hints/status-hints/status-hints.ts";
import type { StatusHint } from "@/server/adapters/bridge/hints/status-hints/status-hints.types.ts";

export const STATUS_HINTS = new InjectionToken<StatusHints>("StatusHints");

/** The hint table's rows, in priority order as the root binds them. */
export const STATUS_HINT_RULES = new InjectionToken<StatusHint>("StatusHintRules");
