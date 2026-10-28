import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../core/ports/clock/clock.port.ts";
import { PinoLogger } from "../../logging/pino-logger/pino-logger.ts";
import { PairingCodes } from "./pairing-codes.ts";

/** Time that moves only when the test says so. */
class FixedClock implements Clock {
  #now = 1_000_000;

  now(): number {
    return this.#now;
  }

  advance(ms: number): void {
    this.#now += ms;
  }
}

/** PairingCodes built by hand with a FixedClock, and every log line it writes. */
class PairingProbe {
  readonly clock = new FixedClock();
  readonly lines: Record<string, unknown>[] = [];
  readonly pairing = new PairingCodes(
    this.clock,
    new PinoLogger(
      {
        level: "info",
        file: "unused",
      },
      [{ write: (line: string) => this.lines.push(JSON.parse(line)) }],
    ),
  );

  /** The code status shows while one window waits. */
  code(): string {
    return this.pairing.status(1)?.code ?? "no code";
  }

  /** Spends the five tries of the code in force with wrong codes; returns the last answer. */
  exhaust(): ReturnType<PairingCodes["check"]> {
    const wrong = this.code() === "000000" ? "000001" : "000000";

    this.pairing.check(wrong);
    this.pairing.check(wrong);
    this.pairing.check(wrong);
    this.pairing.check(wrong);

    return this.pairing.check(wrong);
  }
}

describe("PairingCodes", () => {
  it("mints no code while no plugin window waits", () => {
    const probe = new PairingProbe();

    expect(probe.pairing.status(0)).toBeNull();
    expect(probe.pairing.check("123456")).toEqual({ outcome: "expired" });
    expect(probe.lines).toEqual([]);
  });

  it("keeps one six-digit code for every waiting window until it expires at 120 s", () => {
    const probe = new PairingProbe();
    const first = probe.pairing.status(1);

    expect(first).toEqual({
      code: expect.stringMatching(/^\d{6}$/),
      expiresInSeconds: 120,
      lockedForSeconds: null,
      waiting: 1,
    });
    probe.clock.advance(60_000);
    expect(probe.pairing.status(2)).toMatchObject({
      code: first?.code,
      expiresInSeconds: 60,
      waiting: 2,
    });
    probe.clock.advance(60_000);
    expect(probe.pairing.check(first?.code ?? "")).toEqual({ outcome: "expired" });
    expect(probe.pairing.status(1)?.expiresInSeconds).toBe(120);
  });

  it("accepts the right code once", () => {
    const probe = new PairingProbe();
    const code = probe.code();

    expect(probe.pairing.check(code)).toEqual({ outcome: "ok" });
    expect(probe.pairing.check(code)).toEqual({ outcome: "expired" });
  });

  it("counts a wrong code down, and takes a code of another length or alphabet as wrong, never throwing", () => {
    const probe = new PairingProbe();
    const code = probe.code();

    expect(probe.pairing.check(code === "000000" ? "000001" : "000000")).toEqual({
      outcome: "wrong",
      attemptsLeft: 4,
    });
    expect(probe.pairing.check(`${code.slice(0, 5)}é`)).toEqual({
      outcome: "wrong",
      attemptsLeft: 3,
    });
    expect(probe.pairing.check("")).toEqual({
      outcome: "wrong",
      attemptsLeft: 2,
    });
  });

  it("locks every window after five wrong codes in all: even the right code is refused until the pause ends", () => {
    const probe = new PairingProbe();
    const code = probe.code();

    // The tries belong to the code, not to a window: a lock per socket would let each new socket guess five more.
    expect(probe.exhaust()).toEqual({
      outcome: "locked",
      until: probe.clock.now() + 30_000,
    });
    expect(probe.pairing.check(code)).toMatchObject({ outcome: "locked" });
    expect(probe.pairing.status(3)).toEqual({
      code: null,
      expiresInSeconds: null,
      lockedForSeconds: 30,
      waiting: 3,
    });
    probe.clock.advance(30_000);
    expect(probe.pairing.status(1)).toMatchObject({
      code: expect.stringMatching(/^\d{6}$/),
      lockedForSeconds: null,
    });
  });

  it("doubles the pause with each spent code, from 30 s up to an hour", () => {
    const probe = new PairingProbe();
    const pauses: (number | null | undefined)[] = [];

    for (let round = 0; round < 9; round += 1) {
      probe.exhaust();
      pauses.push(probe.pairing.status(1)?.lockedForSeconds);
      probe.clock.advance(3_600_000);
    }

    expect(pauses).toEqual([30, 60, 120, 240, 480, 960, 1920, 3600, 3600]);
  });

  it("starts the pauses over after a pairing succeeds", () => {
    const probe = new PairingProbe();

    probe.exhaust();
    probe.clock.advance(30_000);
    probe.exhaust();
    probe.clock.advance(60_000);
    expect(probe.pairing.check(probe.code())).toEqual({ outcome: "ok" });
    probe.exhaust();

    expect(probe.pairing.status(1)?.lockedForSeconds).toBe(30);
  });

  it("logs that a code was minted and that pairing locked, never the code itself", () => {
    const probe = new PairingProbe();
    const code = probe.code();

    probe.exhaust();

    expect(probe.lines).toMatchObject([
      {
        level: 30,
        component: "bridge",
        msg: "pairing code minted",
        expiresInMs: 120_000,
      },
      {
        level: 40,
        component: "bridge",
        msg: "pairing locked: a code's tries are spent",
        lockedForMs: 30_000,
      },
    ]);
    // Strings only: a six-digit code could turn up inside a line's time by chance.
    expect(probe.lines.flatMap((line) => Object.values(line).filter((value) => typeof value === "string"))).not.toEqual(
      expect.arrayContaining([expect.stringContaining(code)]),
    );
  });
});
