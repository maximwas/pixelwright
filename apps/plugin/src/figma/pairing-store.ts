import { type PluginKey, PluginKeySchema } from "@pixelwright/core";
import { PAIRING_STORAGE_KEY } from "../constants/plugin.ts";

/** The key an earlier pairing stored; anything else in that slot counts as none. */
export async function readPairing(): Promise<PluginKey | null> {
  const stored = PluginKeySchema.safeParse(await figma.clientStorage.getAsync(PAIRING_STORAGE_KEY));

  return stored.success ? stored.data : null;
}

/** Keeps a newly issued key in place of the stored one; a key is never just deleted (see SocketLink). */
export async function savePairing(key: PluginKey): Promise<void> {
  await figma.clientStorage.setAsync(PAIRING_STORAGE_KEY, key);
}
