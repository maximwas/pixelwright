import { inject, injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { KEY_VALUE_STORE } from "@/core/ports/key-value-store/key-value-store.port.ts";
import { PAIRING_STORAGE_KEY } from "@/plugin/adapters/host/pairing-store/pairing-store.constants.ts";
import { type PluginKey, PluginKeySchema } from "@/shared/protocol/handshake.schema.ts";

/**
 * The paired key, once per computer (P-007). Whatever else sits in its slot counts as none; a key is never deleted,
 * only replaced by one a pairing issued (S-025).
 */
@injectable()
export class PairingStore {
  readonly #store;

  constructor(store = inject(KEY_VALUE_STORE)) {
    this.#store = store;
  }

  async read(): Promise<PluginKey | null> {
    try {
      const stored = zod.safeParse(PluginKeySchema, await this.#store.get(PAIRING_STORAGE_KEY));

      return stored.success ? stored.data : null;
    } catch {
      return null;
    }
  }

  save(key: PluginKey): Promise<void> {
    return this.#store.set(PAIRING_STORAGE_KEY, key);
  }
}
