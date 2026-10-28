import * as zod from "zod/mini";
import { LOG_LEVELS } from "../../adapters/logging/logging.constants.ts";

/** The environment the server reads (S-080); anything unset or unknown falls back to its default. */
export const ServerEnvSchema = zod.object({
  /** Moves the home folder (bridge.json, plugin, logs, stores); default ~/<the channel's home>. */
  PIXELWRIGHT_HOME: zod.optional(zod.string()),
  /** trace, debug, info (default), warn, error, fatal or silent. */
  PIXELWRIGHT_LOG_LEVEL: zod.catch(zod.enum(LOG_LEVELS), "info"),
  /** `off` runs the server without the plugin bridge. */
  PIXELWRIGHT_PLUGIN_BRIDGE: zod.optional(zod.string()),
  /** Comma-separated origins a plugin window may come from besides "null" (S-002). */
  PIXELWRIGHT_PLUGIN_ORIGINS: zod.optional(zod.string()),
});
