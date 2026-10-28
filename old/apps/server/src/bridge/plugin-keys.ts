import { readFileSync } from "node:fs";
import { newKeyId, newSecret, type PluginKey } from "@pixelwright/core";
import writeFileAtomic from "write-file-atomic";
import { BridgeConfigSchema } from "../schemas/bridge.ts";
import type { BridgeConfig, PluginKeys } from "../types/bridge.ts";

/**
 * The keys of paired plugins, in bridge.json next to the port and the peers' token. Read again on every lookup, so a
 * process that takes the port over honours keys another one stored; written atomically, private to the user. A
 * deleted or broken file means no keys (deleting it is how the user revokes them all); adding a key then rebuilds it
 * from the running process's config.
 */
export class FilePluginKeys implements PluginKeys {
  readonly #file: string;
  readonly #fallback: (() => BridgeConfig) | null;
  readonly #warn: (message: string) => void;

  constructor(file: string, fallback: (() => BridgeConfig) | null = null, warn: (message: string) => void = () => {}) {
    this.#file = file;
    this.#fallback = fallback;
    this.#warn = warn;
  }

  find(id: string): PluginKey | null {
    const key = this.#read()?.pluginKeys.find((candidate) => candidate.id === id);

    return key === undefined
      ? null
      : {
          id: key.id,
          secret: key.secret,
        };
  }

  add(): PluginKey {
    const config = this.#read() ?? this.#fallback?.() ?? null;

    if (config === null) {
      throw new Error(`${this.#file} cannot be read, so a new key cannot be stored.`);
    }

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

    writeFileAtomic.sync(this.#file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });

    return key;
  }

  /** The file's config, or null when it is missing or broken. Never logs its content: it holds the token. */
  #read(): BridgeConfig | null {
    try {
      return BridgeConfigSchema.parse(JSON.parse(readFileSync(this.#file, "utf8")));
    } catch (error) {
      const reason = error instanceof Error && "code" in error ? String(error.code) : "invalid content";

      this.#warn(`${this.#file} could not be read (${reason}): no paired plugin keys until it is rewritten.`);

      return null;
    }
  }
}
