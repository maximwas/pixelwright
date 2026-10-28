import type { LogLevel } from "../../adapters/logging/logging.tokens.ts";

/** The server's settings, read once at start. */
export interface ServerConfig {
  readonly home: string;
  readonly logLevel: LogLevel;
  readonly pluginBridge: boolean;
}
