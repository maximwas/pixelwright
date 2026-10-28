import { randomBytes } from "node:crypto";
import { inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock/clock.port.ts";
import { JSON_FILE } from "@/core/ports/json-file/json-file.port.ts";
import { BRIDGE_SETTINGS } from "@/server/adapters/bridge/bridge.tokens.ts";
import { BRIDGE_ENCODING, BRIDGE_TOKEN_BYTES } from "@/server/adapters/bridge/bridge-config/bridge-config.constants.ts";
import { type BridgeFile, BridgeFileSchema } from "@/server/adapters/bridge/bridge-config/bridge-config.schema.ts";
import type { PluginKey } from "@/server/adapters/bridge/bridge-config/bridge-config.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { KEY_ID_BYTES, KEY_SECRET_BYTES } from "@/shared/protocol/protocol.constants.ts";

/**
 * bridge.json in the channel's home, shared by every server of the channel on this machine (S-024). It is read again
 * on every lookup, so a server that takes the port over honours keys another one stored. A missing or broken file
 * means no keys, never a crash (S-014); adding a key then writes a fresh file. Every field is kept on a rewrite,
 * those a newer version wrote too (O-027).
 */
@injectable()
export class BridgeConfig {
  readonly #files;
  readonly #settings;
  readonly #clock;

  constructor(
    files = inject(JSON_FILE),
    settings = inject(BRIDGE_SETTINGS),
    clock = inject(CLOCK),
  ) {
    this.#files = files;
    this.#settings = settings;
    this.#clock = clock;
  }

  /** On the owner's start: the file with a fresh token when there is none; one that exists stays as it is. */
  ensure(): void {
    this.#files.ensure(this.#settings.configFile, this.#fresh());
  }

  /** The token owner and peers prove to each other (S-031); never sent. */
  token(): string {
    return this.#read().token;
  }

  /** The paired plugin's key with this id, or null; the file is read for each lookup. */
  findKey(id: string): PluginKey | null {
    const entry = this.#read().pluginKeys.find((candidate) => candidate.id === id);

    return entry === undefined
      ? null
      : {
        id: entry.id,
        secret: entry.secret,
      };
  }

  /** A new key for a plugin the user just paired, stored beside the others. */
  addKey(): PluginKey {
    const config = this.#read();
    const key = {
      id: randomBytes(KEY_ID_BYTES).toString(BRIDGE_ENCODING.key),
      secret: randomBytes(KEY_SECRET_BYTES).toString(BRIDGE_ENCODING.key),
    };

    this.#files.write(this.#settings.configFile, {
      ...config,
      pluginKeys: [
        ...config.pluginKeys,
        {
          ...key,
          createdAt: new Date(this.#clock.now()).toISOString(),
        },
      ],
    });

    return key;
  }

  #read(): BridgeFile {
    return this.#files.read(this.#settings.configFile, BridgeFileSchema, this.#fresh());
  }

  /** The port is the channel's: the plugin's manifest allows that one only (D-03). */
  #fresh(): BridgeFile {
    return {
      version: 1,
      port: CHANNEL.port,
      token: randomBytes(BRIDGE_TOKEN_BYTES).toString(BRIDGE_ENCODING.token),
      pluginKeys: [],
    };
  }
}
