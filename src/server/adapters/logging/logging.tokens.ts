import { InjectionToken } from "@needle-di/core";
import type { DestinationStream } from "pino";
import type { LOG_LEVEL } from "./logging.constants.ts";

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

/** What the log adapters need from the server's settings. */
export interface LogSettings {
  readonly level: LogLevel;
  /** The log every server of this channel shares: <home>/logs/pixelwright.log. */
  readonly file: string;
}

export const LOG_SETTINGS = new InjectionToken<LogSettings>("LogSettings");

/** Where log lines go: stderr (the MCP client keeps it per session) and the shared file. */
export const LOG_DESTINATIONS = new InjectionToken<DestinationStream>("LogDestinations");
