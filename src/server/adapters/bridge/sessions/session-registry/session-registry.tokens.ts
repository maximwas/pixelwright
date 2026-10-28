import { InjectionToken } from "@needle-di/core";
import type { SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry/session-registry.ts";

export const SESSION_REGISTRY = new InjectionToken<SessionRegistry>("SessionRegistry");
