import * as zod from "zod/mini";
import { PluginInfoSchema } from "./plugin-info.schema.ts";
import {
  KEY_ID_BYTES,
  KEY_SECRET_BYTES,
  NONCE_BYTES,
  PAIRING_CODE_DIGITS,
  PLUGIN_INFO_CHARS,
  PROOF_BYTES,
} from "./protocol.constants.ts";

// The plugin handshake (A§5.2), byte for byte 0.7.0's messages, fields and order (D-04): only the protocol number
// changes. After hello_ack the socket carries RPC frames, which these schemas never see.

/** Each side's half of a challenge, hex. */
const NonceSchema = zod.string().check(zod.regex(new RegExp(`^[0-9a-f]{${NONCE_BYTES * 2}}$`)));

/** HMAC-SHA256 over the role and both nonces (Proof), hex. */
const ProofSchema = zod.string().check(zod.regex(new RegExp(`^[0-9a-f]{${PROOF_BYTES * 2}}$`)));

/** A paired plugin's key, hex: the server keeps it in bridge.json, the plugin in clientStorage. */
const PluginKeySchema = zod.object({
  id: zod.string().check(zod.regex(new RegExp(`^[0-9a-f]{${KEY_ID_BYTES * 2}}$`))),
  secret: zod.string().check(zod.regex(new RegExp(`^[0-9a-f]{${KEY_SECRET_BYTES * 2}}$`))),
});

/** Why the plugin must pair: locked means too many wrong codes, and pairing is paused for expiresInMs. */
const PairingReasonSchema = zod.enum(["no_key", "unknown_key", "wrong_code", "expired", "locked"]);

/** plugin → server, the first frame: within 5 s, or the socket is closed 4408. */
const HelloSchema = zod.object({
  type: zod.literal("hello"),
  protocol: zod.int(),
  plugin: PluginInfoSchema,
  /** The stored key's id, or null before the plugin is paired. */
  keyId: zod.nullable(zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.keyId))),
  nonce: NonceSchema,
});

/**
 * Just enough of a hello to read its protocol (D-02, one exact check), so a plugin of another version is told which
 * protocol this server requires even when the rest of its hello changed. Its version, when it sent a readable one, goes
 * into the status hint.
 */
export const HelloProtocolSchema = zod.looseObject({
  type: zod.literal("hello"),
  protocol: zod.int(),
  plugin: zod.catch(
    zod.nullable(
      zod.looseObject({ pluginVersion: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.pluginVersion)) }),
    ),
    null,
  ),
});

/** What a plugin may send before its hello_ack: hello, the proof of its key, or the code the user typed. */
export const PluginHandshakeSchema = zod.discriminatedUnion("type", [
  HelloSchema,
  zod.object({
    type: zod.literal("auth"),
    proof: ProofSchema,
  }),
  zod.object({
    type: zod.literal("pair"),
    code: zod.string().check(zod.regex(new RegExp(`^\\d{${PAIRING_CODE_DIGITS}}$`))),
  }),
]);

/** What the server sends before RPC starts: it proves the key first, asks for the code, hands a key out, lets in. */
export const ServerHandshakeSchema = zod.discriminatedUnion("type", [
  zod.object({
    type: zod.literal("challenge"),
    nonce: NonceSchema,
    proof: ProofSchema,
  }),
  zod.object({
    type: zod.literal("pairing_required"),
    reason: PairingReasonSchema,
    attemptsLeft: zod.int().check(zod.gte(0)),
    expiresInMs: zod.int().check(zod.gte(0)),
  }),
  zod.object({
    type: zod.literal("paired"),
    key: PluginKeySchema,
  }),
  zod.object({
    type: zod.literal("hello_ack"),
    protocol: zod.int(),
    sessionId: zod.string(),
    server: zod.object({
      name: zod.string(),
      version: zod.string(),
    }),
  }),
]);
