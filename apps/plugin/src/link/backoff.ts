import { RECONNECT } from "../constants/plugin.ts";

/** The wait before reconnect attempt `attempt` (from 0): doubling from 500 ms up to 10 s, with ±50% jitter. */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(RECONNECT.maxMs, RECONNECT.firstMs * 2 ** attempt);

  return Math.round(base * (0.5 + random()));
}
