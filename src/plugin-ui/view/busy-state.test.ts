import { describe, expect, it } from "vitest";
import { BusyState } from "@/plugin-ui/view/busy-state.ts";

describe("BusyState (D-06, A§15.10)", () => {
  it("names the oldest op still running past its answer, in whole seconds since it started", () => {
    const busy = new BusyState();

    busy.show([
      { op: "selection", since: 20_000 },
      { op: "execute", since: 1_000 },
    ]);

    expect(busy.line(36_900)).toBe("Busy: execute since 35 s");

    busy.show([]);

    expect(busy.line(36_900)).toBeNull();
  });
});
