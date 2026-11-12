import * as zod from "zod/mini";
import { NonceSchema, ProofSchema } from "@/shared/protocol/handshake.schema.ts";
import { PEER_HANDSHAKE_TYPE } from "@/shared/protocol/peer-handshake.constants.ts";

/** The peer's first frame, sent without an Origin (S-031); loose, so a newer peer's extra fields still parse. */
export const PeerHelloSchema = zod.object({
  type: zod.literal(PEER_HANDSHAKE_TYPE.peerHello),
  protocol: zod.int(),
  pluginProtocol: zod.optional(zod.int()),
  nonce: NonceSchema,
});

/** The owner proves the bridge.json token over the peer's nonce first; the peer believes nothing from it before. */
export const PeerChallengeSchema = zod.object({
  type: zod.literal(PEER_HANDSHAKE_TYPE.peerChallenge),
  nonce: NonceSchema,
  proof: ProofSchema,
});

/** The peer proves the token back over the owner's nonce. The token never travels. */
export const PeerAuthSchema = zod.object({ type: zod.literal(PEER_HANDSHAKE_TYPE.peerAuth), proof: ProofSchema });

export type PeerHello = zod.output<typeof PeerHelloSchema>;
