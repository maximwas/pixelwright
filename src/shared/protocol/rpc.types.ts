import type { OpResult } from "@/shared/envelope/op-result.schema.ts";

/** What the plugin main serves the server over birpc (A§5.4). */
export interface PluginFunctions {
  run(op: string, input: unknown): Promise<OpResult>;
}

/** What the server serves the plugin: nothing yet (pluginInfo comes with S-012). */
export type ServerFunctions = Record<never, never>;
