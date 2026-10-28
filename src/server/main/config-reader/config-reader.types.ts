import type { LogLevel } from "@/server/adapters/logging/logging.tokens.ts";

/** The server's settings, read once at start. */
export interface ServerConfig {
  readonly home: string;
  readonly logLevel: LogLevel;
  readonly pluginBridge: boolean;
  /** The channel's port; the contract tests give 0 for any free one. */
  readonly bridgePort: number;
  readonly pluginOrigins: readonly string[];
}
