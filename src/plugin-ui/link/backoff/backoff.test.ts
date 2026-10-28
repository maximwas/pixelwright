import { afterEach, describe, expect, it, vi } from "vitest";
import { Backoff } from "@/plugin-ui/link/backoff/backoff.ts";

/** The first `count` waits with random() fixed at `random`. */
const waits = (
  random: number,
  count = 7,
) => {
  vi.spyOn(Math, "random").mockReturnValue(random);

  const backoff = new Backoff();

  return Array.from({ length: count }, () => backoff.next());
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Backoff", () => {
  it("doubles from 500 ms to the 10 s cap, each wait between half and one and a half of it", () => {
    expect(waits(0)).toEqual([250, 500, 1_000, 2_000, 4_000, 5_000, 5_000]);
    expect(waits(0.999_999)).toEqual([750, 1_500, 3_000, 6_000, 12_000, 15_000, 15_000]);
  });

  it("starts the curve over after a reset", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const backoff = new Backoff();

    backoff.next();
    backoff.next();
    backoff.reset();

    expect(backoff.next()).toBe(500);
  });
});
