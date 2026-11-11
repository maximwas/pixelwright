import { describe, expect, it } from "vitest";
import { VersionTries } from "@/server/app/stores/version-tries.ts";

const TEN_MINUTES = 10 * 60 * 1_000;

/** A clock the test moves. */
class FakeClock {
  time = 1_000_000;

  now(): number {
    return this.time;
  }
}

// T-181: a version cannot be deleted, so the same title in the same file is refused for ten minutes.
describe("VersionTries", () => {
  it("refuses a noted title, trimmed and in any case, until ten minutes have passed", () => {
    const clock = new FakeClock();
    const tries = new VersionTries(clock);

    tries.note("session-1", "Before launch");
    clock.time += TEN_MINUTES - 1;

    expect(() => tries.check("session-1", "  BEFORE launch ")).toThrow("BEFORE launch");
    expect(() => tries.check("session-2", "Before launch")).not.toThrow();

    clock.time += 1;

    expect(() => tries.check("session-1", "Before launch")).not.toThrow();
  });

  it("allows the title again once the try is forgotten", () => {
    const tries = new VersionTries(new FakeClock());

    tries.note("session-1", "Before launch");
    tries.forget("session-1", "before launch");

    expect(() => tries.check("session-1", "Before launch")).not.toThrow();
  });
});
