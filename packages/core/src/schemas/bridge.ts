import * as z from "zod";

export const BridgeErrorCodeSchema = z.enum([
  "UNKNOWN_OP",
  "OP_FAILED",
  "TIMEOUT",
  "RESULT_TOO_LARGE",
  "PLUGIN_NOT_CONNECTED",
  "PLUGIN_DISCONNECTED",
  "FILE_NOT_FOUND",
  "RESULT_NOT_SERIALIZABLE",
]);

/** Any string on the wire: a newer plugin may send a code this side does not know (fromWireError maps it). */
export const WireErrorSchema = z.object({
  code: z.string().max(64),
  message: z.string(),
  data: z.unknown().optional(),
});

/**
 * Who the plugin is and where it runs: sent in hello and again in every plugin.info event. Every string is bounded,
 * far above what Figma produces, so whatever connects to the bridge cannot push megabytes into status.
 */
export const PluginInfoSchema = z.object({
  /** Random per plugin window, kept across reconnects: a second hello with it replaces the old socket. */
  instanceId: z.string().max(64),
  pluginVersion: z.string().max(32),
  /** figma.editorType: "figma", or "dev" in Dev Mode. */
  editorType: z.string().max(32),
  /** figma.fileKey is given to private plugins only, so the key is often null. */
  file: z.object({
    name: z.string().max(1_024),
    key: z.string().max(128).nullable(),
  }),
  page: z.object({
    id: z.string().max(64),
    name: z.string().max(1_024),
  }),
  allowEdits: z.boolean(),
  /** The plugin window's document is visible: its file tab is in front. */
  visible: z.boolean(),
});

/** 16 random bytes, hex: each side's half of a challenge. */
export const NonceSchema = z.string().regex(/^[0-9a-f]{32}$/);

/** HMAC-SHA256, hex (see proofFor). */
export const ProofSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** A paired plugin's key: kept by the server in bridge.json and by the plugin in figma.clientStorage. */
export const PluginKeySchema = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  secret: z.string().regex(/^[0-9a-f]{64}$/),
});

/** Why the plugin must pair: locked means too many wrong codes, and pairing is paused for expiresInMs. */
export const PairingReasonSchema = z.enum(["no_key", "unknown_key", "wrong_code", "expired", "locked"]);

// plugin -> server, first frame; the server closes 4408 if it does not arrive in time
const HelloMessageSchema = z.object({
  type: z.literal("hello"),
  protocol: z.number().int(),
  plugin: PluginInfoSchema,
  /** The stored key's id, or null before the plugin is paired. */
  keyId: z.string().max(64).nullable(),
  nonce: NonceSchema,
});

// plugin -> server: the answer to the server's challenge
const AuthMessageSchema = z.object({
  type: z.literal("auth"),
  proof: ProofSchema,
});

// plugin -> server: the pairing code the user typed into the plugin window
const PairMessageSchema = z.object({
  type: z.literal("pair"),
  code: z.string().regex(/^\d{6}$/),
});

// server -> plugin: the server proves it knows the plugin's key, and asks the plugin to prove it back
const ChallengeMessageSchema = z.object({
  type: z.literal("challenge"),
  nonce: NonceSchema,
  proof: ProofSchema,
});

// server -> plugin: the plugin has to be paired (again): the user types the code status shows
const PairingRequiredMessageSchema = z.object({
  type: z.literal("pairing_required"),
  reason: PairingReasonSchema,
  attemptsLeft: z.number().int().nonnegative(),
  expiresInMs: z.number().int().nonnegative(),
});

// server -> plugin: the code was right; the plugin keeps this key for every later connection
const PairedMessageSchema = z.object({
  type: z.literal("paired"),
  key: PluginKeySchema,
});

// server -> plugin
const HelloAckMessageSchema = z.object({
  type: z.literal("hello_ack"),
  protocol: z.number().int(),
  sessionId: z.string(),
  server: z.object({
    name: z.string(),
    version: z.string(),
  }),
});

// server -> plugin
export const RequestMessageSchema = z.object({
  type: z.literal("request"),
  id: z.string(),
  op: z.string(),
  input: z.unknown().optional(),
  timeoutMs: z.number().int().positive(),
});

// plugin -> server
export const ResponseMessageSchema = z.discriminatedUnion("ok", [
  z.object({
    type: z.literal("response"),
    id: z.string(),
    ok: z.literal(true),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("response"),
    id: z.string(),
    ok: z.literal(false),
    error: WireErrorSchema,
  }),
]);

// both ways, fire and forget
export const EventMessageSchema = z.object({
  type: z.literal("event"),
  name: z.string(),
  data: z.unknown().optional(),
});

export const PluginToServerSchema = z.discriminatedUnion("type", [
  HelloMessageSchema,
  AuthMessageSchema,
  PairMessageSchema,
  ResponseMessageSchema,
  EventMessageSchema,
]);

export const ServerToPluginSchema = z.discriminatedUnion("type", [
  ChallengeMessageSchema,
  PairingRequiredMessageSchema,
  PairedMessageSchema,
  HelloAckMessageSchema,
  RequestMessageSchema,
  EventMessageSchema,
]);
