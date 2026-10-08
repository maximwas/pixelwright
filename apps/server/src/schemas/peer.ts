import { PluginInfoSchema, RequestMessageSchema, ResponseMessageSchema } from "@pixelwright/core";
import * as z from "zod";

/** A process joining the bridge's owner says which peer protocol it speaks. */
const PeerHelloSchema = z.object({
  type: z.literal("peer_hello"),
  protocol: z.number().int(),
});

export const ConnectedPluginSchema = z.object({
  session: z.string(),
  info: PluginInfoSchema,
  active: z.boolean(),
});

/** The owner tells its peers which plugins are connected: when they join, and on every change. */
const PluginStatusSchema = z.object({
  type: z.literal("plugin_status"),
  plugins: z.array(ConnectedPluginSchema),
});

/** A peer's request may name the plugin session it is for; without one the owner asks the active plugin. */
export const PeerRequestSchema = RequestMessageSchema.extend({
  session: z.string().exactOptional(),
});

/** peer → owner: the hello, and operations for a plugin. */
export const PeerToOwnerSchema = z.discriminatedUnion("type", [PeerHelloSchema, PeerRequestSchema]);

/** owner → peer: the plugins' status, and answers to operations (the plugin protocol's response). */
export const OwnerToPeerSchema = z.discriminatedUnion("type", [PluginStatusSchema, ResponseMessageSchema]);
