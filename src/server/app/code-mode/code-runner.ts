import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CODE_SANDBOX, type SandboxAnswer } from "@/core/ports/code-sandbox.port.ts";
import type { Logger } from "@/core/ports/logger.port.ts";
import { CODE_LIMITS, CODE_LOG, CODE_TEXT } from "@/server/app/code-mode/code-mode.constants.ts";
import type { CodeAnswer, CodeOutcome, CodeRequest } from "@/server/app/code-mode/code-mode.types.ts";
import { PW_BRIDGE } from "@/server/app/code-mode/pw-bridge.ts";
import { RESULT_CUT } from "@/server/app/code-mode/result-cut.ts";
import { RunCalls } from "@/server/app/code-mode/run-calls.ts";

/**
 * One execute run (research §6): the code in the sandbox with pw's functions, stopped by the deadline or the client's
 * cancel (the code at once, its pending calls by the run's signal at their next plugin round); the answer cut to fit,
 * the images it names after it, and one log line with pwCalls, innerChars, returnedChars (and the arguments clamped)
 * for the measurement.
 */
@injectable()
export class CodeRunner {
  readonly #sandbox;
  readonly #calls;
  readonly #cut;

  constructor(
    sandbox = inject(CODE_SANDBOX),
    calls = inject(PW_BRIDGE),
    cut = inject(RESULT_CUT),
  ) {
    this.#sandbox = sandbox;
    this.#calls = calls;
    this.#cut = cut;
  }

  async run({ code, timeoutMs, file, signal, logger }: CodeRequest): Promise<CodeOutcome> {
    const controller = new AbortController();
    let end: (reason: string) => void = () => undefined;
    const stop = new Promise<string>((resolve) => {
      end = resolve;
    });
    const halt = (reason: string) => {
      controller.abort(new Error(reason));
      end(reason);
    };
    const cancel = () => halt(CODE_TEXT.cancelled);
    const timer = setTimeout(() => halt(CODE_TEXT.timedOut(timeoutMs)), timeoutMs);
    const calls = new RunCalls(this.#calls, controller.signal, file);

    signal.addEventListener(CODE_TEXT.abortEvent, cancel, { once: true });

    if (signal.aborted) {
      cancel();
    }

    try {
      const answer = await this.#sandbox.run({
        code,
        names: this.#calls.names(),
        shapes: this.#calls.shapes(),
        call: async (name, args) => await calls.call(name, args),
        limits: CODE_LIMITS.sandbox,
        stop,
      });

      return this.#answer(answer, calls, logger);
    } finally {
      controller.abort(new Error(CODE_TEXT.ended));
      clearTimeout(timer);
      signal.removeEventListener(CODE_TEXT.abortEvent, cancel);
    }
  }

  #answer(
    ran: SandboxAnswer,
    calls: RunCalls,
    logger: Logger,
  ): CodeOutcome {
    const { result, chars } = this.#cut.result(ran.result, CODE_LIMITS.resultChars);
    const { images, notShown } = calls.named(ran.result);
    const clamped = calls.clamped();
    const answer: CodeAnswer = {
      result,
      logs: this.#cut.logs(ran.logs, CODE_LIMITS.logChars, ran.earlierLines),
      ...(ran.error === undefined ? {} : { error: ran.error }),
      calls: calls.tally(),
      ...(clamped.length === 0 ? {} : { clamped }),
      ...(chars === undefined ? {} : { resultChars: chars }),
      ...(notShown.length === 0 ? {} : { notShown }),
    };

    logger.info(CODE_LOG.run, {
      pwCalls: calls.made(),
      innerChars: calls.innerChars(),
      returnedChars: JSON.stringify(answer).length,
      ...(clamped.length === 0 ? {} : { clamped: clamped.length }),
    });

    return { answer, images };
  }
}

export const CODE_RUNNER = new InjectionToken<CodeRunner>("CodeRunner");
