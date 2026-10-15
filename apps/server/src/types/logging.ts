import type { Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/** What the tool-call log writes with: a pino logger, or anything with its two methods. */
export interface ToolCallLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}
