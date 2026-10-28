import type { PROOF_ROLE } from "./proof.constants.ts";

export type ProofRole = (typeof PROOF_ROLE)[keyof typeof PROOF_ROLE];
