import {
  isFail,
  type QuickJSContext,
  type QuickJSDeferredPromise,
  type QuickJSHandle,
  type QuickJSRuntime,
} from "quickjs-emscripten-core";
import type { SandboxAnswer, SandboxRun } from "@/core/ports/code-sandbox.port.ts";
import PW_UTILS from "@/server/adapters/sandbox/data/pw-utils.json" with { type: "json" };
import { SANDBOX_SCRIPT, SANDBOX_TEXT } from "@/server/adapters/sandbox/sandbox.constants.ts";

/** An error as QuickJS dumps it: an Error's fields, or whatever else the code threw. */
type Thrown = { readonly name?: unknown; readonly message?: unknown; readonly stack?: unknown } | null;

/**
 * One run in its own QuickJS runtime. Each pw call is a QuickJS promise the host settles, so several run at once; the
 * interrupt handler stops the code past its CPU slice or once the run is stopped; the run ends once, by the code's
 * value, its error, or the stop, and then the context and the runtime go, pending calls with them.
 */
export class QuickJsRun {
  readonly #runtime: QuickJSRuntime;
  readonly #context: QuickJSContext;
  readonly #run: SandboxRun;
  readonly #logs: string[] = [];
  readonly #pending = new Set<QuickJSDeferredPromise>();
  #logChars = 0;
  #earlierLines = 0;
  #end: (answer: SandboxAnswer) => void = () => undefined;
  #sliceStart = 0;
  #busy = false;
  #alive = true;
  #stopped: string | undefined;

  constructor(
    runtime: QuickJSRuntime,
    context: QuickJSContext,
    run: SandboxRun,
  ) {
    this.#runtime = runtime;
    this.#context = context;
    this.#run = run;
  }

  async answer(): Promise<SandboxAnswer> {
    void this.#run.stop.then((reason) => {
      this.#stopped = reason;
      this.#fail(reason);
    });

    return await new Promise<SandboxAnswer>((resolve) => {
      this.#end = resolve;
      this.#start();
    });
  }

  /**
   * Frees the run's context and runtime, its pending calls with them; false when QuickJS aborted doing so (a stack
   * overflow or an out of memory inside JSON left objects alive), and its WASM module must not run code again.
   */
  dispose(): boolean {
    this.#alive = false;

    try {
      for (const deferred of this.#pending) {
        deferred.dispose();
      }

      this.#context.dispose();
      this.#runtime.dispose();

      return true;
    } catch {
      return false;
    }
  }

  #start(): void {
    // The prelude's own work starts the first slice.
    this.#sliceStart = Date.now();
    this.#runtime.setInterruptHandler(() => this.#interrupted());

    const prelude = this.#context.unwrapResult(
      this.#context.evalCode(SANDBOX_SCRIPT.prelude, SANDBOX_SCRIPT.preludeName),
    );
    const host = this.#host();
    const start = this.#context.unwrapResult(this.#context.callFunction(prelude, this.#context.undefined, ...host));

    for (const handle of [prelude, ...host]) {
      handle.dispose();
    }

    const body = this.#context.evalCode(SANDBOX_SCRIPT.wrapped(this.#run.code), SANDBOX_SCRIPT.fileName);

    if (isFail(body)) {
      this.#fail(this.#thrown(this.#dumped(body.error)));
      start.dispose();

      return;
    }

    const started = this.#guest(() => this.#context.callFunction(start, this.#context.undefined, body.value));

    start.dispose();
    body.value.dispose();

    // The code's first part runs inside the call: a stop it cannot catch (CPU, memory) comes back from it.
    if (started === undefined) {
      return;
    }

    if (isFail(started)) {
      this.#fail(this.#thrown(this.#dumped(started.error)));

      return;
    }

    started.value.dispose();
    this.#drain();
  }

  /** The prelude's arguments: call, log, done, failed, pw's names and shapes as JSON, and the utils' function of pw. */
  #host(): QuickJSHandle[] {
    const context = this.#context;

    return [
      context.newFunction(SANDBOX_SCRIPT.call, (name, args) =>
        this.#call(context.getString(name), context.getString(args)),
      ),
      context.newFunction(SANDBOX_SCRIPT.log, (line) => {
        this.#log(context.getString(line));
      }),
      context.newFunction(SANDBOX_SCRIPT.done, (json) => {
        this.#finish(JSON.parse(context.getString(json)));
      }),
      context.newFunction(SANDBOX_SCRIPT.failed, (error) => {
        this.#fail(this.#thrown(context.dump(error) as Thrown));
      }),
      context.newString(JSON.stringify(this.#run.names)),
      context.newString(JSON.stringify(this.#run.shapes)),
      context.unwrapResult(context.evalCode(PW_UTILS.source, SANDBOX_SCRIPT.utilsName)),
    ];
  }

  /**
   * Each line leaves QuickJS's memory limit for the server's, so only the last lines within logChars stay as they come
   * (a longer line by its end), the earlier ones counted: a loop logging megabytes never piles them up here.
   */
  #log(line: string): void {
    const kept = line.slice(-this.#run.limits.logChars);

    this.#logs.push(kept);
    this.#logChars += kept.length;

    while (this.#logChars > this.#run.limits.logChars) {
      this.#logChars -= this.#logs.shift()?.length ?? 0;
      this.#earlierLines += 1;
    }
  }

  /** A pw call: a QuickJS promise now, settled when the host's call answers, unless the run has ended by then. */
  #call(name: string, args: string): QuickJSHandle {
    const deferred = this.#context.newPromise();

    this.#pending.add(deferred);
    this.#run.call(name, JSON.parse(args)).then(
      (value) => this.#settle(deferred, JSON.stringify(value ?? null), true),
      (error: unknown) => this.#settle(deferred, error instanceof Error ? error.message : String(error), false),
    );

    return deferred.handle;
  }

  #settle(
    deferred: QuickJSDeferredPromise,
    text: string,
    resolved: boolean,
  ): void {
    if (!this.#alive) {
      return;
    }

    this.#pending.delete(deferred);

    const handle = resolved
      ? this.#context.newString(text)
      : this.#context.newError({ name: SANDBOX_TEXT.errorName, message: text });

    if (resolved) {
      deferred.resolve(handle);
    } else {
      deferred.reject(handle);
    }

    handle.dispose();
    this.#drain();
  }

  /** Runs the code's pending jobs; a stop the code cannot catch (the interrupt) ends the run here. */
  #drain(): void {
    if (!this.#alive) {
      return;
    }

    const jobs = this.#guest(() => this.#runtime.executePendingJobs());

    if (jobs !== undefined && isFail(jobs)) {
      this.#fail(this.#thrown(this.#dumped(jobs.error)));
    }
  }

  /**
   * Guest work starts a CPU slice. A host error out of the WASM ends the run with its own words: JSON.stringify of a
   * value ~10,000 levels deep overflows Node's stack, not QuickJS's, and throws a RangeError here.
   */
  #guest<Value>(work: () => Value): Value | undefined {
    this.#sliceStart = Date.now();
    this.#busy = false;

    try {
      return work();
    } catch (error) {
      this.#fail(String(error));

      return undefined;
    }
  }

  #interrupted(): boolean {
    if (this.#stopped !== undefined) {
      return true;
    }

    this.#busy = Date.now() - this.#sliceStart > this.#run.limits.cpuSliceMs;

    return this.#busy;
  }

  #dumped(handle: QuickJSHandle): Thrown {
    const error = this.#context.dump(handle) as Thrown;

    handle.dispose();

    return error;
  }

  /** Why the code failed: the abort's reason, the CPU stop, or its error with the code's own line, quoted. */
  #thrown(error: Thrown): string {
    if (this.#stopped !== undefined) {
      return this.#stopped;
    }

    if (this.#busy) {
      return SANDBOX_TEXT.busy(this.#run.limits.cpuSliceMs);
    }

    if (typeof error !== "object" || error === null) {
      return SANDBOX_TEXT.thrown(SANDBOX_TEXT.errorName, String(error));
    }

    const thrown = SANDBOX_TEXT.thrown(String(error.name ?? SANDBOX_TEXT.errorName), String(error.message ?? ""));

    return [thrown, ...this.#place(String(error.stack ?? ""))].join(SANDBOX_TEXT.lineBreak);
  }

  #place(stack: string): string[] {
    const place = SANDBOX_SCRIPT.place.exec(stack);
    const lines = this.#run.code.split(SANDBOX_TEXT.lineBreak);
    const line = Number(place?.[1] ?? 0) - SANDBOX_SCRIPT.linesBefore;

    if (place === null || line < 1 || line > lines.length) {
      return [];
    }

    const quoted = (lines[line - 1] ?? "").trim().slice(0, SANDBOX_TEXT.quotedChars);

    return [SANDBOX_TEXT.at(line, Number(place[2])), SANDBOX_TEXT.quoted(line, quoted)];
  }

  #fail(error: string): void {
    this.#finish(null, error);
  }

  #finish(result: unknown, error?: string): void {
    if (this.#alive) {
      this.#alive = false;
      this.#end({
        result,
        logs: this.#logs,
        ...(this.#earlierLines === 0 ? {} : { earlierLines: this.#earlierLines }),
        ...(error === undefined ? {} : { error }),
      });
    }
  }
}
