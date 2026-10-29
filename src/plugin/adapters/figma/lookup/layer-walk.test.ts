import { expect, it } from "vitest";
import type { Clock } from "@/core/ports/clock.port.ts";
import { LayerWalk } from "@/plugin/adapters/figma/lookup/layer-walk.ts";

const LAYERS = 100_000;

/** Time that moves on 1 ms each time it is read. */
class TickingClock implements Clock {
  reads = 0;

  now(): number {
    this.reads += 1;

    return this.reads;
  }
}

function* numbers(count: number): Generator<number> {
  for (let index = 0; index < count; index += 1) {
    yield index;
  }
}

// P-075: findAll cannot be stopped; the walk reads the clock every 500 layers and stops once the deadline is past.
it("stops a long walk soon after its deadline, reading the clock once per 500 layers, not at the end only", () => {
  const clock = new TickingClock();
  const walk = new LayerWalk(clock);

  const walked = walk.until(numbers(LAYERS), 3, { accepts: () => true, enough: Number.POSITIVE_INFINITY });

  expect(walked.cut).toBe(true);
  expect(walked.kept).toEqual([...numbers(1_500)]);
  expect(clock.reads).toBe(4);
});

// P-075, T-040: a walk the deadline cut answers with what it reached, so its first batch is looked up all the same.
it("looks up the first batch of what a cut walk kept, then stops at the passed deadline", async () => {
  const walk = new LayerWalk(new TickingClock());
  const taken: [number, number][] = [];

  const cut = await walk.lookUp([...numbers(60)], 0, {
    lookup: async (item) => await Promise.resolve(item * 10),
    take: (item, value) => taken.push([item, value]),
    enough: () => false,
  });

  expect(cut).toBe(true);
  expect(taken).toEqual([...numbers(25)].map((item) => [item, item * 10]));
});
