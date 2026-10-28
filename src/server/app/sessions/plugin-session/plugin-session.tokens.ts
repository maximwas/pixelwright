import { InjectionToken } from "@needle-di/core";
import type { PluginSession } from "@/server/app/sessions/plugin-session/plugin-session.ts";
import type { OpCallStep } from "@/server/app/sessions/plugin-session/plugin-session.types.ts";

/** The session one call is bound to (T-002): bound per call in the tool's child container, for tools that take `file`. */
export const PLUGIN_SESSION = new InjectionToken<PluginSession>("PluginSession");

/** A session's op chain, outermost first, in the order the composition root binds them. */
export const OP_CALL_STEPS = new InjectionToken<OpCallStep>("OpCallSteps");
