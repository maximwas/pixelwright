import type { LOG_LEVEL } from "@/server/adapters/logging/logging.constants.ts";

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

/** What the log adapters need from the server's settings. */
export interface LogSettings {
  readonly level: LogLevel;
  /** The log every server of this channel shares: <home>/logs/pixelwright.log. */
  readonly file: string;
}
