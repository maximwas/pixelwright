import { DEFAULT_PLUGIN_ORIGINS } from "../constants/bridge.ts";
import type { AppConfig } from "../types/config.ts";
import type { LogLevel } from "../types/logging.ts";

const LOG_LEVELS: ReadonlySet<string> = new Set(["trace", "debug", "info", "warn", "error", "fatal", "silent"]);

const isLogLevel = (value: string): value is LogLevel => LOG_LEVELS.has(value);

/** The server's settings from its environment; anything unset or unknown falls back to the default. */
export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const level = env.PIXELWRIGHT_LOG_LEVEL?.trim() ?? "";
  const extraOrigins = (env.PIXELWRIGHT_PLUGIN_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  return {
    logLevel: isLogLevel(level) ? level : "info",
    bridgeEnabled: env.PIXELWRIGHT_PLUGIN_BRIDGE?.trim() !== "off",
    pluginOrigins: [...new Set([...DEFAULT_PLUGIN_ORIGINS, ...extraOrigins])],
    projectRoot: env.CLAUDE_PROJECT_DIR?.trim() || null,
  };
}
