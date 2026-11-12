import type { OpResult } from "@/shared/envelope/op-result.schema.ts";
import type { PluginInfoUpdate } from "@/shared/protocol/plugin-info.schema.ts";

/** What the plugin main serves the server over birpc (A§5.4). */
export interface PluginFunctions {
  run(op: string, input: unknown): Promise<OpResult>;
}

/** What the server serves the plugin: plugin info events (S-012), sent as birpc events, never answered. */
export interface ServerFunctions {
  pluginInfo(info: PluginInfoUpdate): void;
}
