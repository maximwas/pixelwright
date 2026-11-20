import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { CodeSandbox, SandboxRun } from "@/core/ports/code-sandbox.port.ts";
import type { Logger } from "@/core/ports/logger.port.ts";
import { CodeRunner } from "@/server/app/code-mode/code-runner.ts";
import type { PwAnswer, PwCalls } from "@/server/app/code-mode/pw-bridge.ts";
import { ResultCut } from "@/server/app/code-mode/result-cut.ts";
import { CallId } from "@/server/app/tool-runner/call-id.ts";
import { VersionedWrite } from "@/server/app/writes/versioned-write.ts";
import { EXECUTE_TEXT } from "@/server/tools/execute/execute.constants.ts";
import { ExecuteTool } from "@/server/tools/execute/execute.tool.ts";
import { ServerCode } from "@/server/tools/execute/server-code.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";
import { saveVersionOp } from "@/shared/ops/save-version/save-version.manifest.ts";

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

/** pw.shot answers an image, which the script returns by its handle. */
class ShotCall implements CodeSandbox {
  async run({ call }: SandboxRun) {
    const shot = (await call("shot", {})) as { image: string };

    return { result: shot.image, logs: [] };
  }
}

const IMAGE = { type: "image", data: "iVBOR", mimeType: "image/png" } as const;

class ShotCalls extends FileCalls {
  override async call(): Promise<PwAnswer> {
    return { value: {}, images: [IMAGE] };
  }
}

/** The plugin of the call's file: remembers every op it was asked to run, and the input of each. */
class OpsSession {
  readonly ops: unknown[] = [];
  readonly inputs: unknown[] = [];

  async run(op: unknown, input?: unknown) {
    this.ops.push(op);
    this.inputs.push(input);

    return op === saveVersionOp ? { id: "7" } : { result: 1, logs: [] };
  }
}

const calls = new FileCalls();
const session = new OpsSession();
const folder = await mkdtemp(join(tmpdir(), "execute-tool-"));
const tool = new ExecuteTool(
  session as never,
  new VersionedWrite(),
  { callId: CallId.next(), logger: QUIET, signal: new AbortController().signal },
  new ServerCode(
    { resolve: async (path: string) => join(folder, path) } as never,
    new CodeRunner(new OneCall(), calls, new ResultCut()),
  ),
);
const shotTool = new ExecuteTool(
  session as never,
  new VersionedWrite(),
  { callId: CallId.next(), logger: QUIET, signal: new AbortController().signal },
  new ServerCode({} as never, new CodeRunner(new ShotCall(), new ShotCalls(), new ResultCut())),
);

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
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

  it("refuses a script with a version before anything runs: a script never writes, so it saves nothing", async () => {
    session.ops.length = 0;
    calls.files.length = 0;

    await expect(tool.execute({ script: "return 1;", version: "Before" })).rejects.toThrow(EXECUTE_TEXT.scriptVersion);
    expect(session.ops).toEqual([]);
    expect(calls.files).toEqual([]);
  });

  it("saves the version before plugin code runs and answers it", async () => {
    session.ops.length = 0;

    const answer = await tool.execute({ code: "return 1;", version: "Before" });

    expect(session.ops).toEqual([saveVersionOp, executeOp]);
    expect(answer.structuredContent).toMatchObject({ result: 1, version: { id: "7", title: "Before" } });
  });

  it("saves nothing and runs nothing for code with a syntax error, even with a version", async () => {
    session.ops.length = 0;

    const answer = await tool.execute({ code: "return (;", version: "Before" });

    expect(session.ops).toEqual([]);
    expect(answer.structuredContent).toHaveProperty("error");
    expect(answer.structuredContent).not.toHaveProperty("version");
  });

  it("answers a script's JSON first, then the image it returned", async () => {
    const answer = await shotTool.execute({ script: "return 1;" });

    expect(answer.content[0]).toEqual({ type: "text", text: JSON.stringify(answer.structuredContent) });
    expect(answer.content[1]).toEqual(IMAGE);
    expect(answer.structuredContent).toMatchObject({ result: "image-1" });
  });

  it("runs a codePath file's source in the plugin, and refuses a path that is no file", async () => {
    await writeFile(join(folder, "plugin-code.txt"), "return 42;");
    session.ops.length = 0;
    session.inputs.length = 0;

    await tool.execute({ codePath: "plugin-code.txt" });

    expect(session.ops).toEqual([executeOp]);
    expect(session.inputs[0]).toMatchObject({ code: "return 42;" });
    await expect(tool.execute({ codePath: "missing.txt" })).rejects.toThrow(
      EXECUTE_TEXT.notAFile("missing.txt", join(folder, "missing.txt")),
    );
  });
});
