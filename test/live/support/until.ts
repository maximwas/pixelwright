import { setTimeout as sleep } from "node:timers/promises";

const POLL_MS = 500;

/** The first value `read` gives that is not null, asked every half second; null once `limitMs` has passed. */
export async function until<Value>(read: () => Promise<Value | null>, limitMs: number): Promise<Value | null> {
  const deadline = Date.now() + limitMs;

  while (Date.now() < deadline) {
    const value = await read();

    if (value !== null) {
      return value;
    }

    await sleep(POLL_MS);
  }

  return null;
}
