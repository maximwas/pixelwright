import { InjectionToken } from "@needle-di/core";
import type { DestinationStream } from "pino";
import type { LOG_LEVELS } from "./logging.constants.ts";

export type LogLevel = (typeof LOG_LEVELS)[number];

/** What the log adapters need from the server's settings. */
export interface LogSettings {
  readonly level: LogLevel;
  /** The log every server of this channel shares: <home>/logs/pixelwright.log. */
  readonly file: string;
}

export const LOG_SETTINGS = new InjectionToken<LogSettings>("LogSettings");

/** Where log lines go: stderr (the MCP client keeps it per session) and the shared file. */
export const LOG_DESTINATIONS = new InjectionToken<DestinationStream>("LogDestinations");
