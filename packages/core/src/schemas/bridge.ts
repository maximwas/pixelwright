import * as z from "zod";

export const BridgeErrorCodeSchema = z.enum([
  "UNKNOWN_OP",
  "OP_FAILED",
  "TIMEOUT",
  "RESULT_TOO_LARGE",
  "PLUGIN_NOT_CONNECTED",
  "PLUGIN_DISCONNECTED",
  "FILE_NOT_FOUND",
]);

export const WireErrorSchema = z.object({
  code: BridgeErrorCodeSchema,
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

// plugin -> server, first frame; the server closes 4408 if it does not arrive in time
const HelloMessageSchema = z.object({
  type: z.literal("hello"),
  protocol: z.number().int(),
  plugin: PluginInfoSchema,
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
  ResponseMessageSchema,
  EventMessageSchema,
]);

export const ServerToPluginSchema = z.discriminatedUnion("type", [
  HelloAckMessageSchema,
  RequestMessageSchema,
  EventMessageSchema,
]);
