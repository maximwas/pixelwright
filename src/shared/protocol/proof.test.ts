import { describe, expect, it } from "vitest";
import { Proof, type ProofRole } from "@/shared/protocol/proof.ts";

const PLUGIN_NONCE = "00112233445566778899aabbccddeeff";
const SERVER_NONCE = "ffeeddccbbaa99887766554433221100";

/**
 * Proofs 0.7.0 made: its own proofFor (old/packages/core/src/bridge/proof.ts) run under Node 24 on these secrets and
 * nonces, the first one also checked against node:crypto's createHmac. A pairing stored by 0.7.0 keeps working only
 * while these stay equal (D-04).
 */
const VECTORS_0_7_0: readonly {
  secret: string;
  role: ProofRole;
  theirNonce: string;
  ourNonce: string;
  proof: string;
}[] = [
  {
    secret: "ab".repeat(32),
    role: "server",
    theirNonce: PLUGIN_NONCE,
    ourNonce: SERVER_NONCE,
    proof: "b58b2f134efb5f06dabaf4a8e931a728e42af13c61d6f7de86194b6b5c260ff8",
  },
  {
    secret: "ab".repeat(32),
    role: "plugin",
    theirNonce: SERVER_NONCE,
    ourNonce: PLUGIN_NONCE,
    proof: "3bff079f38884c4a12d49ccc8eb55072b11e86c97303b696d9f69f098d3f4b55",
  },
  {
    secret: "5e".repeat(32),
    role: "server",
    theirNonce: PLUGIN_NONCE,
    ourNonce: SERVER_NONCE,
    proof: "07abfbc2817151e2cf4891764164f2743174222fd5626f7276dd8b0883943c19",
  },
  {
    secret: "5e".repeat(32),
    role: "plugin",
    theirNonce: SERVER_NONCE,
    ourNonce: PLUGIN_NONCE,
    proof: "1a72e6f84dcc018be2b71ac6978f71a72035256afe783ff6f8e4f89ac61e3fa2",
  },
];

describe("Proof", () => {
  it.each(VECTORS_0_7_0)("signs as 0.7.0 did: $secret as $role", ({ secret, role, theirNonce, ourNonce, proof }) => {
    expect(Proof.sign(secret, role, theirNonce, ourNonce).hex()).toBe(proof);
  });

  it("differs by role and by nonce order, so a proof cannot be reflected back", () => {
    const secret = "ab".repeat(32);
    const server = Proof.sign(secret, "server", PLUGIN_NONCE, SERVER_NONCE);

    expect(server.equals(Proof.sign(secret, "plugin", PLUGIN_NONCE, SERVER_NONCE))).toBe(false);
    expect(server.equals(Proof.sign(secret, "server", SERVER_NONCE, PLUGIN_NONCE))).toBe(false);
    expect(server.equals(Proof.sign(secret, "server", PLUGIN_NONCE, SERVER_NONCE))).toBe(true);
  });

  it("equals a proof from the wire with the same hex only", () => {
    const hex = VECTORS_0_7_0[0]?.proof ?? "";
    const proof = Proof.of(hex);

    expect(proof.equals(Proof.of(hex))).toBe(true);
    expect(proof.equals(Proof.of(`${hex.slice(0, -1)}0`))).toBe(false);
    expect(proof.equals(Proof.of(hex.slice(0, -2)))).toBe(false);
  });
});
