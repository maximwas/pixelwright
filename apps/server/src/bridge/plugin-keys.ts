import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { newKeyId, newSecret, type PluginKey } from "@pixelwright/core";
import { BridgeConfigSchema } from "../schemas/bridge.ts";
import type { BridgeConfig, PluginKeys } from "../types/bridge.ts";

/**
 * The keys of paired plugins, in bridge.json next to the port and the peers' token. Read again on every lookup, so a
 * process that takes the port over honours keys another one stored; written atomically, private to the user.
 */
export class FilePluginKeys implements PluginKeys {
  readonly #file: string;

  constructor(file: string) {
    this.#file = file;
  }

  find(id: string): PluginKey | null {
    const key = this.#read().pluginKeys.find((candidate) => candidate.id === id);

    return key === undefined
      ? null
      : {
          id: key.id,
          secret: key.secret,
        };
  }

  add(): PluginKey {
    const config = this.#read();
    const key = {
      id: newKeyId(),
      secret: newSecret(),
    };
    const next: BridgeConfig = {
      ...config,
      pluginKeys: [
        ...config.pluginKeys,
        {
          ...key,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    const temp = `${this.#file}.${process.pid}.tmp`;

    writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, this.#file);

    return key;
  }

  #read(): BridgeConfig {
    return BridgeConfigSchema.parse(JSON.parse(readFileSync(this.#file, "utf8")));
  }
}
