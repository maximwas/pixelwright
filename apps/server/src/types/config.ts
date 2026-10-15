import type { LogLevel } from "./logging.ts";

export interface AppConfig {
  readonly logLevel: LogLevel;
  readonly bridgeEnabled: boolean;
  readonly pluginOrigins: readonly string[];
  /** The project whose Code Connect templates design_read runs: CLAUDE_PROJECT_DIR, else null (the working directory). */
  readonly projectRoot: string | null;
  /** The weekly support note after a change that worked: on unless PIXELWRIGHT_SUPPORT_REMINDERS is off. */
  readonly supportReminders: boolean;
  /** The log every pixelwright process on this machine also writes to, which `pixelwright logs` follows. */
  readonly logFile: string;
}
