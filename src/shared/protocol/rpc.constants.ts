import { LIMITS } from "@/shared/limits/limits.constants.ts";

/**
 * birpc's own timeout, above the longest op's (S-009): it only frees a call the plugin never answered. The real deadline
 * is the server's per-call timer from the op meta.
 */
export const RPC_TIMEOUT_MS = LIMITS.requestMaxTimeoutMs + 10_000;
