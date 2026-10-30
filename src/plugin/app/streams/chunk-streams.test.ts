import { expect, it } from "vitest";
import { ChunkStreams } from "@/plugin/app/streams/chunk-streams.ts";

const render = Uint8Array.from({ length: 10 }, (_value, index) => index);

// T-075: a render goes out in chunks and is dropped once read whole; at most four are held, the oldest dropped first.
it("hands a render out in chunks, drops it once read whole and holds at most four", () => {
  const streams = new ChunkStreams();

  expect(streams.hold("a", render)).toBe(10);
  expect(streams.chunk("a", 0, 4)).toEqual({ totalBytes: 10, bytes: render.subarray(0, 4) });
  expect(streams.chunk("a", 4, 8).bytes).toEqual(render.subarray(4, 10));
  expect(() => streams.chunk("a", 0, 4)).toThrow(/export it again/);

  for (const stream of ["1", "2", "3", "4", "5"]) {
    streams.hold(stream, render);
  }

  expect(() => streams.chunk("1", 0, 4)).toThrow(/export it again/);
  expect(streams.chunk("2", 0, 4).totalBytes).toBe(10);
});
