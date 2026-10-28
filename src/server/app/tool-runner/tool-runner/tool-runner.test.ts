import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { Clock } from "@/core/ports/clock/clock.port.ts";
import type { LogFields, Logger } from "@/core/ports/logger/logger.port.ts";
import { CallLogStep } from "@/server/app/tool-runner/steps/call-log-step/call-log-step.ts";
import { ErrorTextStep } from "@/server/app/tool-runner/steps/error-text-step/error-text-step.ts";
import { OutputCheckStep } from "@/server/app/tool-runner/steps/output-check-step/output-check-step.ts";
import { Tool } from "@/server/app/tool-runner/tool/tool.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { ToolRunner } from "@/server/app/tool-runner/tool-runner/tool-runner.ts";
import type { ToolContext, ToolFactory } from "@/server/app/tool-runner/tool-runner/tool-runner.types.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";

const ProbeInput = zod.object({
  file: zod.optional(zod.string()),
  text: zod.string(),
  fail: zod.optional(zod.string()),
});
const ProbeOutput = zod.object({
  length: zod.number(),
  errors: zod.array(zod.string()),
});

/** A tool whose input says how it ends: an answer, an expected failure, a bug, or an answer outside its schema. */
class ProbeTool extends Tool<zod.output<typeof ProbeInput>, zod.output<typeof ProbeOutput>> {
  protected readonly input = ProbeInput;

  protected async run({ text, fail }: zod.output<typeof ProbeInput>): Promise<zod.output<typeof ProbeOutput>> {
    if (fail === "expected") {
      throw new PixelwrightError("NODE_NOT_FOUND", "No layer 1:2 in this file.");
    }

    if (fail === "bug") {
      throw new TypeError("boom\nat line two");
    }

    return fail === "schema"
      ? {
        length: -1,
        errors: [],
      }
      : {
        length: text.length,
        errors: ["2:3: kept"],
      };
  }

  protected override answer(output: zod.output<typeof ProbeOutput>) {
    const answer = super.answer(output);

    return output.length < 0
      ? {
        ...answer,
        structuredContent: { length: "wrong" },
      }
      : answer;
  }
}

const MANIFEST: ToolManifest = {
  name: "probe",
  title: "Probe",
  description: "A tool for the runner's tests.",
  input: ProbeInput,
  output: ProbeOutput,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  load: async () => ProbeTool,
};

/** Each reading 5 ms after the last, so every call takes 5 ms. */
class SteppingClock implements Clock {
  #now = 1_000;

  now(): number {
    this.#now += 5;

    return this.#now;
  }
}

/** The Logger port as a sink: each line as {level, msg, ...fields}, with the fields of the children it came through. */
class RecordingLogger implements Logger {
  readonly lines: Record<string, unknown>[];
  readonly #fields: LogFields;

  constructor(
    lines: Record<string, unknown>[] = [],
    fields: LogFields = {},
  ) {
    this.lines = lines;
    this.#fields = fields;
  }

  trace(
    message: string,
    fields?: LogFields,
  ): void {
    this.#write("trace", message, fields);
  }

  debug(
    message: string,
    fields?: LogFields,
  ): void {
    this.#write("debug", message, fields);
  }

  info(
    message: string,
    fields?: LogFields,
  ): void {
    this.#write("info", message, fields);
  }

  warn(
    message: string,
    fields?: LogFields,
  ): void {
    this.#write("warn", message, fields);
  }

  error(
    message: string,
    fields?: LogFields,
  ): void {
    this.#write("error", message, fields);
  }

  child(fields: LogFields): Logger {
    return new RecordingLogger(this.lines, {
      ...this.#fields,
      ...fields,
    });
  }

  #write(
    level: string,
    msg: string,
    fields: LogFields = {},
  ): void {
    this.lines.push({
      level,
      msg,
      ...this.#fields,
      ...fields,
    });
  }
}

class ProbeFactory implements ToolFactory {
  readonly contexts: ToolContext[] = [];

  async create(
    _manifest: ToolManifest,
    context: ToolContext,
  ): Promise<Tool> {
    this.contexts.push(context);

    return new ProbeTool();
  }
}

class RunnerProbe {
  readonly logger = new RecordingLogger();
  readonly lines = this.logger.lines;
  readonly factory = new ProbeFactory();
  readonly runner = new ToolRunner(
    [new ErrorTextStep(), new CallLogStep(this.logger, new SteppingClock()), new OutputCheckStep()],
    this.factory,
    this.logger,
  );

  run(args: Record<string, unknown>) {
    return this.runner.run({
      manifest: MANIFEST,
      args,
      signal: new AbortController().signal,
    });
  }
}

describe("ToolRunner", () => {
  it("answers structuredContent plus the same JSON as text, partial failures inside errors[]", async () => {
    const answer = await new RunnerProbe().run({ text: "four" });

    expect(answer).toEqual({
      content: [
        {
          type: "text",
          text: '{"length":4,"errors":["2:3: kept"]}',
        },
      ],
      structuredContent: {
        length: 4,
        errors: ["2:3: kept"],
      },
    });
  });

  it("turns an expected failure into an isError answer that starts with its code", async () => {
    const answer = await new RunnerProbe().run({
      text: "",
      fail: "expected",
    });

    expect(answer).toEqual({
      isError: true,
      content: [
        {
          type: "text",
          text: "NODE_NOT_FOUND: No layer 1:2 in this file.",
        },
      ],
    });
  });

  it("turns a bug into an internal error that names the tool and the first line only", async () => {
    const answer = await new RunnerProbe().run({
      text: "",
      fail: "bug",
    });

    expect(answer.content).toEqual([
      {
        type: "text",
        text: "Internal error in probe: boom; see pixelwright logs",
      },
    ]);
  });

  it("refuses an answer outside the outputSchema as a bug", async () => {
    const answer = await new RunnerProbe().run({
      text: "",
      fail: "schema",
    });

    expect(answer.isError).toBe(true);
    expect(answer.content[0]?.text).toMatch(/^Internal error in probe: the answer does not match its outputSchema/);
  });

  it("logs each call with its tool, callId, file and ms, never its arguments", async () => {
    const probe = new RunnerProbe();

    await probe.run({
      file: "Test MCP",
      text: "a secret layer name",
    });

    expect(probe.lines).toEqual([
      expect.objectContaining({
        level: "info",
        component: "tool-runner",
        msg: "tool probe",
        tool: "probe",
        callId: probe.factory.contexts[0]?.callId.value,
        file: "Test MCP",
        ms: 5,
      }),
    ]);
    expect(JSON.stringify(probe.lines)).not.toContain("a secret layer name");
  });

  it("logs an expected failure at warn and a bug at error, each with the error itself", async () => {
    const probe = new RunnerProbe();

    await probe.run({
      text: "",
      fail: "expected",
    });
    await probe.run({
      text: "",
      fail: "bug",
    });

    expect(probe.lines).toEqual([
      expect.objectContaining({
        level: "warn",
        msg: "tool probe failed",
        err: expect.objectContaining({ code: "NODE_NOT_FOUND" }),
      }),
      expect.objectContaining({
        level: "error",
        msg: "tool probe failed",
        err: expect.any(TypeError),
      }),
    ]);
  });

  it("gives every call its own callId and a logger that carries it", async () => {
    const probe = new RunnerProbe();

    await probe.run({ text: "one" });
    await probe.run({ text: "two" });

    const [first, second] = probe.factory.contexts;

    expect(first?.callId.value).not.toBe(second?.callId.value);
    first?.logger.info("inside the tool");
    expect(probe.lines.at(-1)).toMatchObject({
      callId: first?.callId.value,
      tool: "probe",
      component: "tool",
    });
  });
});
