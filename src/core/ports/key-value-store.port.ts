import { InjectionToken } from "@needle-di/core";

/**
 * Values the plugin keeps between runs on this computer (A§3): the pairing key, later Allow edits per file and the
 * dismissed update. What comes back is untrusted: whoever reads it parses it.
 */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const KEY_VALUE_STORE = new InjectionToken<KeyValueStore>("KeyValueStore");
