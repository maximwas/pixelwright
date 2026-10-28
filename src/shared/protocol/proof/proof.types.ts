import type { PROOF_ROLE } from "@/shared/protocol/proof/proof.constants.ts";

export type ProofRole = (typeof PROOF_ROLE)[keyof typeof PROOF_ROLE];
