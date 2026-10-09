import { PluginKeySchema } from "@pixelwright/core";
import * as z from "zod";

export const PortSchema = z.number().int().min(1024).max(65_535);

/**
 * bridge.json: the port, the token other pixelwright processes prove they know, and the keys of paired plugins
 * (deleting the file revokes them all).
 */
export const BridgeConfigSchema = z.object({
  version: z.literal(1),
  port: PortSchema,
  token: z.string().min(32), // 32 random bytes, base64url (43 chars)
  pluginKeys: z.array(PluginKeySchema.extend({ createdAt: z.string() })).default([]),
});
