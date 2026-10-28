import { homedir } from "node:os";
import { join } from "node:path";
import * as zod from "zod/mini";
import { CHANNEL } from "../../../shared/protocol/channel.constants.ts";
import { ServerEnvSchema } from "./config-reader.schema.ts";
import type { ServerConfig } from "./config-reader.types.ts";

/** Reads the server's settings from its environment, once, before anything is built. */
export class ConfigReader {
  readonly #env: Readonly<Record<string, string | undefined>>;
  /** The user's home folder; asked of the system only when the environment names none. */
  readonly #homeDir: string | undefined;

  constructor(
    env: Readonly<Record<string, string | undefined>> = process.env,
    homeDir?: string,
  ) {
    this.#env = env;
    this.#homeDir = homeDir;
  }

  read(): ServerConfig {
    const env = zod.parse(ServerEnvSchema, this.#env);

    return {
      home: env.PIXELWRIGHT_HOME?.trim() || join(this.#homeDir ?? homedir(), CHANNEL.home),
      logLevel: env.PIXELWRIGHT_LOG_LEVEL,
      pluginBridge: env.PIXELWRIGHT_PLUGIN_BRIDGE?.trim().toLowerCase() !== "off",
      // No variable moves the port: the plugin's manifest allows the channel's port only (D-03).
      bridgePort: CHANNEL.port,
      pluginOrigins: (env.PIXELWRIGHT_PLUGIN_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ""),
    };
  }
}
