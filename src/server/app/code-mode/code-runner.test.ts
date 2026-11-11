import { describe, expect, it } from "vitest";
import type { CodeSandbox, SandboxAnswer, SandboxRun } from "@/core/ports/code-sandbox.port.ts";
import type { LogFields, Logger } from "@/core/ports/logger.port.ts";
import { CodeRunner } from "@/server/app/code-mode/code-runner.ts";
import type { PwAnswer, PwCalls } from "@/server/app/code-mode/pw-bridge.ts";
import { ResultCut } from "@/server/app/code-mode/result-cut.ts";

type Pw = Record<string, (args?: unknown) => Promise<unknown>>;
type Guest = (pw: Pw) => Promise<unknown>;

/** Runs the test's function as the guest code: pw from the run's own call, a stop answered with its reason. */
class FakeSandbox implements CodeSandbox {
  readonly #guest: Guest;

  constructor(guest: Guest) {
    this.#guest = guest;
  }

  async run({ names, call, stop }: SandboxRun): Promise<SandboxAnswer> {
    const pw: Pw = Object.fromEntries(
      names.map((name) => [name, async (args?: unknown) => await call(name, args ?? {})]),
    );
    const aborted = stop.then((error) => ({ result: null, logs: [], error }));
    const ran = this.#guest(pw).then(
      (result) => ({ result, logs: [] }),
      (error: Error) => ({ result: null, logs: [], error: `Error: ${error.message}` }),
    );

    return await Promise.race([ran, aborted]);
  }
}

/** pw.echo answers its arguments after a tick, pw.shot an image, pw.wait never; it counts the calls in flight. */
class FakeCalls implements PwCalls {
  inFlight = 0;
  most = 0;
  /** Each call's signal, in the order the calls reached the bridge. */
  readonly signals: AbortSignal[] = [];

  names(): readonly string[] {
    return ["echo", "shot", "wait"];
  }

  shapes() {
    return {};
  }

  async call(
    name: string,
    args: unknown,
    signal: AbortSignal,
  ): Promise<PwAnswer> {
    this.signals.push(signal);

    if (name === "wait") {
      return await new Promise(() => undefined);
    }

    this.inFlight += 1;
    this.most = Math.max(this.most, this.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.inFlight -= 1;

    return name === "shot"
      ? { value: { text: "PNG" }, images: [{ type: "image", data: "iVBOR", mimeType: "image/png" }] }
      : { value: { args }, images: [] };
  }
}

class RecordingLogger implements Logger {
  readonly lines: [string, LogFields | undefined][] = [];

  trace(): void {}

  debug(): void {}

  warn(): void {}

  error(): void {}

  info(message: string, fields?: LogFields): void {
    this.lines.push([message, fields]);
  }

  child(): Logger {
    return this;
  }
}

function runner(guest: Guest, calls: PwCalls = new FakeCalls()): CodeRunner {
  return new CodeRunner(new FakeSandbox(guest), calls, new ResultCut());
}

function request(
  logger: Logger = new RecordingLogger(),
  timeoutMs = 60_000,
  signal = new AbortController().signal,
) {
  return { code: "return null;", timeoutMs, signal, logger };
}

describe("CodeRunner", () => {
  it("refuses the 51st pw call of a run, naming the cap, and answers the calls that succeeded", async () => {
    const { answer } = await runner(async (pw) => {
      for (let index = 0; index < 51; index += 1) {
        await pw.echo?.({ index });
      }
    }).run(request());

    expect(answer.error).toBe(
      "Error: pw.echo: a run makes at most 50 pw calls: filter inside one call, or split the work into runs.",
    );
    expect(answer.calls).toEqual({ "pw.echo": 50 });
  });

  it("keeps at most 4 pw calls in flight, the rest waiting their turn", async () => {
    const calls = new FakeCalls();

    await runner(
      async (pw) => await Promise.all(Array.from({ length: 10 }, (_slot, index) => pw.echo?.({ index }))),
      calls,
    ).run(request());

    expect(calls.most).toBe(4);
  });

  it("shows the images the result names, at most 4, after the text, and names the ones it left out", async () => {
    const { answer, images } = await runner(async (pw) => {
      const shots: unknown[] = [];

      for (let index = 0; index < 5; index += 1) {
        shots.push(await pw.shot?.());
      }

      return shots;
    }).run(request());

    expect(answer.result).toEqual([1, 2, 3, 4, 5].map((number) => ({ text: "PNG", image: `image-${number}` })));
    expect(images).toHaveLength(4);
    expect(answer.notShown).toEqual(["image-5"]);
  });

  it("lists in the answer and in the run's log line each argument the bridge clamped to its bound", async () => {
    const clamp = { call: "pw.find", path: "limit", given: 1000, used: 500 };
    const calls: PwCalls = {
      names: () => ["find"],
      shapes: () => ({}),
      call: async () => ({ value: { found: [] }, images: [], clamped: [clamp] }),
    };
    const logger = new RecordingLogger();
    const { answer } = await runner(async (pw) => await pw.find?.({ limit: 1000 }), calls).run(request(logger));

    expect(answer).toEqual({ result: { found: [] }, logs: [], calls: { "pw.find": 1 }, clamped: [clamp] });
    expect(logger.lines[0]?.[1]).toMatchObject({ pwCalls: 1, clamped: 1 });
  });

  it("logs each run's pw calls, the characters they answered inside and the characters it returns", async () => {
    const logger = new RecordingLogger();
    const { answer } = await runner(async (pw) => {
      await pw.echo?.({ big: "x".repeat(1_000) });

      return "small";
    }).run(request(logger));

    expect(logger.lines).toEqual([
      ["code run", { pwCalls: 1, innerChars: 1_019, returnedChars: JSON.stringify(answer).length }],
    ]);
  });

  it("stops a run past its time in the run's own words, and a cancelled one in its own, aborting their pending calls", async () => {
    const lateCalls = new FakeCalls();
    const late = await runner(async (pw) => await pw.wait?.(), lateCalls).run(request(new RecordingLogger(), 20));
    const controller = new AbortController();
    const cancelledCalls = new FakeCalls();
    const cancelled = runner(async (pw) => await pw.wait?.(), cancelledCalls).run(
      request(new RecordingLogger(), 60_000, controller.signal),
    );

    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort();

    expect(late.answer.error).toBe(
      "The run took longer than 0.02 s: give execute a longer timeout, or split the work into runs.",
    );
    expect((await cancelled).answer.error).toBe("The run was cancelled.");
    expect([...lateCalls.signals, ...cancelledCalls.signals].map(({ aborted }) => aborted)).toEqual([true, true]);
  });

  // Calls the code did not await kept reaching the plugin after the model had the answer, plugin code included.
  it("aborts the calls still pending when the run ends, and a queued one never reaches the bridge", async () => {
    const calls = new FakeCalls();
    const { answer } = await runner(async (pw) => {
      for (let index = 0; index < 10; index += 1) {
        void pw.echo?.({ index }).catch(() => undefined);
      }

      return 1;
    }, calls).run(request());

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(answer.result).toBe(1);
    expect(calls.signals.length).toBeLessThanOrEqual(4);
    expect(calls.signals.every(({ aborted }) => aborted)).toBe(true);
  });
});
