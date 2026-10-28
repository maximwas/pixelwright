import { InjectionToken } from "@needle-di/core";
import type { SessionRegistry } from "./session-registry.ts";

export const SESSION_REGISTRY = new InjectionToken<SessionRegistry>("SessionRegistry");
