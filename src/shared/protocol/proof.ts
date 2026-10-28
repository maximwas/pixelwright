import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { type PROOF_ROLE, PROOF_TEXT } from "@/shared/protocol/protocol.constants.ts";

/**
 * A handshake proof (S-023), a value object: HMAC-SHA256 of the shared secret over
 * `pixelwright|<role>|<theirNonce>|<ourNonce>`, hex. Each side signs the nonce the other just made, theirs first, so a
 * proof can be neither replayed nor reflected back. Byte for byte 0.7.0's: every pairing a user made depends on it
 * (D-04). @noble/hashes, because the plugin window has no secure context for crypto.subtle.
 */
export class Proof {
  readonly #hex: string;

  private constructor(hex: string) {
    this.#hex = hex;
  }

  /** The proof that `role` knows `secret`, over the nonce the other side sent and its own. */
  static sign(
    secret: string,
    role: ProofRole,
    theirNonce: string,
    ourNonce: string,
  ): Proof {
    const message = PROOF_TEXT.message(role, theirNonce, ourNonce);

    return new Proof(bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(message))));
  }

  /** A proof as it came over the wire, hex (the handshake schema checked its shape). */
  static of(hex: string): Proof {
    return new Proof(hex);
  }

  /** Compares every character, never stopping at the first difference, so the time taken tells a guesser nothing. */
  equals(other: Proof): boolean {
    const left = this.#hex;
    const right = other.#hex;

    if (left.length !== right.length) {
      return false;
    }

    let difference = 0;

    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return difference === 0;
  }

  hex(): string {
    return this.#hex;
  }
}

export type ProofRole = (typeof PROOF_ROLE)[keyof typeof PROOF_ROLE];
