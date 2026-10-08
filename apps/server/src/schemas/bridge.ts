import * as z from "zod";

export const PortSchema = z.number().int().min(1024).max(65_535);

/** bridge.json: the port and the token the plugin needs to open the bridge. */
export const BridgeConfigSchema = z.object({
  version: z.literal(1),
  port: PortSchema,
  token: z.string().min(32), // 32 random bytes, base64url (43 chars)
});
