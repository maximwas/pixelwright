import type { Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
