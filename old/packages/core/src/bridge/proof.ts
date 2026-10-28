import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/** Who is proving it knows the shared secret: the bridge server or the plugin, the owner or a peer. */
export type ProofRole = "server" | "plugin" | "owner" | "peer";

export const newNonce = (): string => bytesToHex(randomBytes(16));

export const newSecret = (): string => bytesToHex(randomBytes(32));

export const newKeyId = (): string => bytesToHex(randomBytes(8));

/**
 * HMAC-SHA256 of the shared secret over the prover's role and both nonces, theirs first: each side signs the nonce
 * the other side just made, so a proof can be neither replayed nor reflected back.
 */
export function proofFor(secret: string, role: ProofRole, theirNonce: string, ourNonce: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`pixelwright|${role}|${theirNonce}|${ourNonce}`)));
}

/** Compares two proofs (or codes) without stopping at the first difference. */
export function proofEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}
