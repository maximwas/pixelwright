import { InjectionToken } from "@needle-di/core";
import type { DestinationStream } from "pino";
import type { LogSettings } from "@/server/adapters/logging/logging.types.ts";

export const LOG_SETTINGS = new InjectionToken<LogSettings>("LogSettings");

/** Where log lines go: stderr (the MCP client keeps it per session) and the shared file. */
export const LOG_DESTINATIONS = new InjectionToken<DestinationStream>("LogDestinations");
