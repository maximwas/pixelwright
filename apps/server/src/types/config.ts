import type { LogLevel } from "./logging.ts";

export interface AppConfig {
  readonly logLevel: LogLevel;
  readonly bridgeEnabled: boolean;
  readonly pluginOrigins: readonly string[];
}
