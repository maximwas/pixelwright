import * as zod from "zod/mini";

/** Cursor's mcp.json as far as the setup reads it: mcpServers an object; every other key is kept as it is. */
export const CursorConfigSchema = zod.looseObject({
  mcpServers: zod.optional(zod.record(zod.string(), zod.unknown())),
});

/** A plugin manifest's name: a folder whose manifest names this channel's plugin holds a copy the setup may replace. */
export const PluginManifestSchema = zod.object({ name: zod.string() });
