import {
  NonceSchema,
  PluginInfoSchema,
  ProofSchema,
  RequestMessageSchema,
  ResponseMessageSchema,
} from "@pixelwright/core";
import * as z from "zod";

/**
 * A process joining the bridge's owner says which peer and plugin protocols it speaks, with its half of the challenge.
 * The hello, the challenge and the answer stay as they are in every version: an owner hands its port to a newer server
 * only after this handshake, so a newer peer protocol may change only what follows it.
 */
const PeerHelloSchema = z.object({
  type: z.literal("peer_hello"),
  protocol: z.number().int(),
  pluginProtocol: z.number().int().exactOptional(),
  nonce: NonceSchema,
});

/** The owner proves it knows bridge.json's token, over the peer's nonce, and challenges the peer back. */
const PeerChallengeSchema = z.object({
  type: z.literal("peer_challenge"),
  nonce: NonceSchema,
  proof: ProofSchema,
});

/** The peer's answer: the token never travels, only proofs over each other's nonces. */
const PeerAuthSchema = z.object({
  type: z.literal("peer_auth"),
  proof: ProofSchema,
});

export const ConnectedPluginSchema = z.object({
  session: z.string(),
  info: PluginInfoSchema,
  active: z.boolean(),
});

export const PairingStatusSchema = z.object({
  code: z.string().nullable(),
  expiresAt: z.number().nullable(),
  lockedUntil: z.number().nullable(),
  waiting: z.number().int(),
});

/** The owner tells its peers which plugins are connected and what code pairing waits for: when they join, on changes. */
const PluginStatusSchema = z.object({
  type: z.literal("plugin_status"),
  plugins: z.array(ConnectedPluginSchema),
  pairing: PairingStatusSchema.nullable(),
});

/** A peer's request may name the plugin session it is for; without one the owner asks the active plugin. */
export const PeerRequestSchema = RequestMessageSchema.extend({
  session: z.string().exactOptional(),
});

export const PeerToOwnerSchema = z.discriminatedUnion("type", [PeerHelloSchema, PeerAuthSchema, PeerRequestSchema]);

export const OwnerToPeerSchema = z.discriminatedUnion("type", [
  PeerChallengeSchema,
  PluginStatusSchema,
  ResponseMessageSchema,
]);
