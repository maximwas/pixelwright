import { describe, expect, it } from "vitest";
import type { CodeSandbox, SandboxRun } from "@/core/ports/code-sandbox.port.ts";
import type { Logger } from "@/core/ports/logger.port.ts";
import { CodeRunner } from "@/server/app/code-mode/code-runner.ts";
import type { PwAnswer, PwCalls } from "@/server/app/code-mode/pw-bridge.ts";
import { ResultCut } from "@/server/app/code-mode/result-cut.ts";
import { CallId } from "@/server/app/tool-runner/call-id.ts";
import { EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { ExecuteTool } from "@/server/tools/execute/execute.tool.ts";

const QUIET: Logger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => QUIET,
};

/** Makes one pw call, as a script would. */
class OneCall implements CodeSandbox {
  async run({ call }: SandboxRun) {
    await call("echo", {});

    return { result: null, logs: [] };
  }
}

/** Remembers the file each pw call was given as its default. */
class FileCalls implements PwCalls {
  readonly files: (string | undefined)[] = [];

  names() {
    return ["echo"];
  }

  shapes() {
    return {};
  }

  async call(
    _name: string,
    _args: unknown,
    _signal: AbortSignal,
    file?: string,
  ): Promise<PwAnswer> {
    this.files.push(file);

    return { value: {}, images: [] };
  }
}

const calls = new FileCalls();
const tool = new ExecuteTool({} as never, {} as never, new CodeRunner(new OneCall(), calls, new ResultCut()), {
  callId: CallId.next(),
  logger: QUIET,
  signal: new AbortController().signal,
});

describe("ExecuteTool", () => {
  it("refuses none of code, codePath and script, and two of them", async () => {
    await expect(tool.execute({})).rejects.toThrow(EXECUTE_TEXT.oneOf);
    await expect(tool.execute({ code: "return 1;", script: "return 2;" })).rejects.toThrow(EXECUTE_TEXT.oneOf);
    await expect(tool.execute({ codePath: "a.js", script: "return 2;" })).rejects.toThrow(EXECUTE_TEXT.oneOf);
  });

  it("runs a script for the call's file, so its pw calls read that file", async () => {
    await tool.execute({ script: "return 1;", file: "A" });

    expect(calls.files).toEqual(["A"]);
  });
});
