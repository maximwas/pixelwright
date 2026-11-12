import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LiveClient } from "../support/live-client.ts";

const PINGS = 50;
/** A ping to the visible tab's plugin takes about a ms (P1); the 95th of 50 stays well under this. */
const P95_LIMIT_MS = 50;

describe("bridge/probe", () => {
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(async () => {
    await client.close();
  });

  it(`answers ${PINGS} pings with a 95th percentile under ${P95_LIMIT_MS} ms`, async () => {
    const times: number[] = [];

    for (let ping = 0; ping < PINGS; ping += 1) {
      const { probe } = (await client.call("status", { probe: true })) as { probe: { ok: boolean; ms: number } };

      expect(probe.ok).toBe(true);
      times.push(probe.ms);
    }

    times.sort((left, right) => left - right);

    expect(times[Math.ceil(PINGS * 0.95) - 1]).toBeLessThan(P95_LIMIT_MS);
  });
});
