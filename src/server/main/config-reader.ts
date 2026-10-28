import { homedir } from "node:os";
import { join } from "node:path";
import * as zod from "zod/mini";
import { CHANNEL } from "../../shared/protocol/channel.constants.ts";
import { ServerEnvSchema } from "./config-reader.schema.ts";
import type { ServerConfig } from "./config-reader.types.ts";

/** Reads the server's settings from its environment, once, before anything is built. */
export class ConfigReader {
  readonly #env: Readonly<Record<string, string | undefined>>;
  readonly #homeDir: string;

  constructor(
    env: Readonly<Record<string, string | undefined>> = process.env,
    homeDir = homedir(),
  ) {
    this.#env = env;
    this.#homeDir = homeDir;
  }

  read(): ServerConfig {
    const env = zod.parse(ServerEnvSchema, this.#env);

    return {
      home: env.PIXELWRIGHT_HOME?.trim() || join(this.#homeDir, CHANNEL.home),
      logLevel: env.PIXELWRIGHT_LOG_LEVEL,
      pluginBridge: env.PIXELWRIGHT_PLUGIN_BRIDGE?.trim().toLowerCase() !== "off",
    };
  }
}
