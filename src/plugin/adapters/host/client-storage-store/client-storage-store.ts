import { injectable } from "@needle-di/core";
import type { KeyValueStore } from "@/core/ports/key-value-store/key-value-store.port.ts";

/**
 * KeyValueStore over figma.clientStorage (Adapter): kept per user and per plugin id, shared by every file (FX-005), so
 * a pairing is once per computer and the dev channel's never meets 0.7.0's.
 */
@injectable()
export class ClientStorageStore implements KeyValueStore {
  get(key: string): Promise<unknown> {
    return figma.clientStorage.getAsync(key);
  }

  set(
    key: string,
    value: unknown,
  ): Promise<void> {
    return figma.clientStorage.setAsync(key, value);
  }
}
