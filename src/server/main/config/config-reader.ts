import { homedir } from "node:os";
import { join } from "node:path";
import * as zod from "zod/mini";
import type { LogLevel } from "@/server/adapters/logging/logging.types.ts";
import { SERVER_ENV } from "@/server/main/config/config.constants.ts";
import { ServerEnvSchema } from "@/server/main/config/config-reader.schema.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** Reads the server's settings from its environment, once, before anything is built. */
export class ConfigReader {
  readonly #env: Readonly<Record<string, string | undefined>>;
  /** The user's home folder; asked of the system only when the environment names none. */
  readonly #homeDir: string | undefined;
  /** The server's working directory; asked of the process only when the environment names no project. */
  readonly #cwd: string | undefined;

  constructor(
    env: Readonly<Record<string, string | undefined>> = process.env,
    homeDir?: string,
    cwd?: string,
  ) {
    this.#env = env;
    this.#homeDir = homeDir;
    this.#cwd = cwd;
  }

  read(): ServerConfig {
    const env = zod.parse(ServerEnvSchema, this.#env);

    return {
      home: env.PIXELWRIGHT_HOME?.trim() || join(this.#homeDir ?? homedir(), CHANNEL.home),
      logLevel: env.PIXELWRIGHT_LOG_LEVEL,
      pluginBridge: env.PIXELWRIGHT_PLUGIN_BRIDGE?.trim().toLowerCase() !== SERVER_ENV.bridgeOff,
      // No variable moves the port: the plugin's manifest allows the channel's port only (D-03).
      bridgePort: CHANNEL.port,
      pluginOrigins: (env.PIXELWRIGHT_PLUGIN_ORIGINS ?? "")
        .split(SERVER_ENV.listSeparator)
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ""),
      projectDir: env.CLAUDE_PROJECT_DIR?.trim() || (this.#cwd ?? process.cwd()),
      updateCheck: !env.PIXELWRIGHT_NO_UPDATE_CHECK?.trim(),
    };
  }
}

/** The server's settings, read once at start. */
export interface ServerConfig {
  readonly home: string;
  readonly logLevel: LogLevel;
  readonly pluginBridge: boolean;
  /** The channel's port; the contract tests give 0 for any free one. */
  readonly bridgePort: number;
  readonly pluginOrigins: readonly string[];
  /** Where relative paths start when the MCP client lists no file root (T-008). */
  readonly projectDir: string;
  /** Whether npm is asked for the update banner (S-070); the configs tests build leave it out, so it stays off. */
  readonly updateCheck?: boolean;
}
