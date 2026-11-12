import * as zod from "zod/mini";
import { BRIDGE_TOKEN_MIN_CHARS } from "@/server/adapters/bridge/listener/listener.constants.ts";
import { HANDSHAKE_PATTERN } from "@/shared/protocol/handshake.constants.ts";
import { KEY_ID_BYTES, KEY_SECRET_BYTES } from "@/shared/protocol/protocol.constants.ts";

/** Loose: a field a newer Pixelwright wrote is kept when this one rewrites the file (O-027). */
const PluginKeyEntrySchema = zod.looseObject({
  id: zod.string().check(zod.regex(HANDSHAKE_PATTERN.hex(KEY_ID_BYTES))),
  secret: zod.string().check(zod.regex(HANDSHAKE_PATTERN.hex(KEY_SECRET_BYTES))),
  createdAt: zod.string(),
});

/**
 * bridge.json v1 (S-024), the format 0.7.0 users have paired plugins in: the port, the token other servers prove they
 * know, and the paired plugins' keys. Deleting the file revokes every key.
 */
export const BridgeFileSchema = zod.looseObject({
  version: zod.literal(1),
  port: zod.int().check(zod.gte(1024), zod.lte(65_535)),
  token: zod.string().check(zod.minLength(BRIDGE_TOKEN_MIN_CHARS)),
  pluginKeys: zod._default(zod.array(PluginKeyEntrySchema), []),
});

export type BridgeFile = zod.output<typeof BridgeFileSchema>;
