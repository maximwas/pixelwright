import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { Logger } from "@/core/ports/logger.port.ts";
import { AnswerShapes } from "@/server/app/code-mode/answer-shapes.ts";
import { PwBridge } from "@/server/app/code-mode/pw-bridge.ts";
import { ErrorTextStep } from "@/server/app/tool-runner/steps/error-text-step.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { type ToolAnswer, type ToolFactory, ToolRunner } from "@/server/app/tool-runner/tool-runner.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

const FindInput = zod.strictObject({ name: zod.string(), limit: zod.optional(zod.number().check(zod.maximum(500))) });
const ReadInput = zod.strictObject({ node: zod.string() });
/** pw.outline's depth as its schema has it: an integer 1 to 10 with a default. */
const OutlineInput = zod.strictObject({ depth: zod._default(zod.int().check(zod.minimum(1), zod.maximum(10)), 3) });

/** Finds a layer by name; "missing" is an expected failure. */
class FindTool extends Tool<zod.output<typeof FindInput>> {
  protected readonly input = FindInput;

  protected async run({ name, limit }: zod.output<typeof FindInput>) {
    if (name === "missing") {
      throw new PixelwrightError("NODE_NOT_FOUND", "No layer named missing.");
    }

    return { found: [{ id: "1:2", name }], ...(limit === undefined ? {} : { limit }) };
  }
}

/** Answers the depth it ran with. */
class OutlineEcho extends Tool<zod.output<typeof OutlineInput>> {
  protected readonly input = OutlineInput;

  protected async run({ depth }: zod.output<typeof OutlineInput>) {
    return { depth };
  }
}

/** Answers in text and image blocks, with the plain value code gets beside them (design_read's way). */
class ReadTool extends Tool<zod.output<typeof ReadInput>> {
  protected readonly input = ReadInput;

  protected async run({ node }: zod.output<typeof ReadInput>) {
    return { node };
  }

  protected override answer({ node }: Record<string, unknown>): ToolAnswer {
    const xml = `<Frame id="${String(node)}" />`;

    return {
      content: [
        { type: "text", text: xml },
        { type: "image", data: "iVBOR", mimeType: "image/png" },
      ],
      value: { xml },
    };
  }
}

const WhichInput = zod.strictObject({ file: zod.exactOptional(zod.string()) });

/** Answers the file it ran with. */
class WhichFile extends Tool<zod.output<typeof WhichInput>> {
  protected readonly input = WhichInput;

  protected async run({ file }: zod.output<typeof WhichInput>) {
    return { file: file ?? null };
  }
}

const ANNOTATIONS = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
const FIND: ToolManifest = {
  name: "nodes_find",
  title: "Find",
  description: "Finds layers.",
  input: FindInput,
  annotations: ANNOTATIONS,
  load: async () => FindTool,
};
const READ: ToolManifest = {
  name: "design_read",
  title: "Read",
  description: "Reads a layer.",
  input: ReadInput,
  annotations: ANNOTATIONS,
  load: async () => ReadTool,
};

const WHICH: ToolManifest = {
  name: "status",
  title: "Which",
  description: "Names its file.",
  input: WhichInput,
  annotations: ANNOTATIONS,
  load: async () => WhichFile,
};

const OUTLINE: ToolManifest = {
  name: "outline",
  title: "Outline",
  description: "Lists the layer tree.",
  input: OutlineInput,
  annotations: ANNOTATIONS,
  load: async () => OutlineEcho,
};

const QUIET: Logger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => QUIET,
};

/** Every call gets a fresh tool, as the container factory gives it. */
const FACTORY: ToolFactory = { create: async (manifest) => new (await manifest.load())() };

const bridge = new PwBridge(
  new ToolRunner([new ErrorTextStep()], FACTORY, QUIET),
  new Map([
    ["nodesFind", FIND],
    ["designRead", READ],
    ["outline", OUTLINE],
    ["status", WHICH],
  ]),
  new AnswerShapes(),
);
const signal = new AbortController().signal;

describe("PwBridge", () => {
  // execute's own file is the file of every pw call that names none; a tool without a file key is left alone.
  it("gives a call without a file the run's file, lets a file in the call win, and skips a tool that takes none", async () => {
    expect((await bridge.call("status", {}, signal, "A")).value).toEqual({ file: "A" });
    expect((await bridge.call("status", { file: "B" }, signal, "A")).value).toEqual({ file: "B" });
    // { file: opts.file } with no file given still means "none named".
    expect((await bridge.call("status", { file: undefined }, signal, "A")).value).toEqual({ file: "A" });
    expect((await bridge.call("nodesFind", { name: "Card" }, signal, "A")).value).toEqual({
      found: [{ id: "1:2", name: "Card" }],
    });
  });

  it("checks the arguments with the tool's own input schema and names the function and each wrong path, before the tool runs", async () => {
    await expect(bridge.call("nodesFind", { name: "Card", limit: "ten", bogus: 1 }, signal)).rejects.toThrow(
      /^pw\.nodesFind: limit: Invalid input.*; args: Unrecognized key: "bogus" \(accepted: name, limit\)$/,
    );
  });

  // A refused bound costs the model a whole turn: the call runs at the bound, and the run's answer says so.
  it("clamps a number past its schema's bound to the bound before the check, the call going on", async () => {
    expect(await bridge.call("nodesFind", { name: "Card", limit: 1000 }, signal)).toEqual({
      value: { found: [{ id: "1:2", name: "Card" }], limit: 500 },
      images: [],
      clamped: [{ call: "pw.nodesFind", path: "limit", given: 1000, used: 500 }],
    });
    expect((await bridge.call("outline", { depth: 50 }, signal)).value).toEqual({ depth: 10 });
    await expect(bridge.call("nodesFind", { name: "Card", limit: 1000, bogus: 1 }, signal)).rejects.toThrow(
      /^pw\.nodesFind: args: Unrecognized key: "bogus" \(accepted: name, limit\)$/,
    );
  });

  // A model that guessed a key name ("ids") fixes it in the same turn when the refusal names the keys there are.
  it("names the keys a function takes when it refuses one it does not", async () => {
    await expect(bridge.call("designRead", { ids: ["1:2"] }, signal)).rejects.toThrow(
      'pw.designRead: node: Invalid input: expected string; args: Unrecognized key: "ids" (accepted: node)',
    );
  });

  it("runs a call through the tool runner and answers its structuredContent as a plain value", async () => {
    expect(await bridge.call("nodesFind", { name: "Card" }, signal)).toEqual({
      value: { found: [{ id: "1:2", name: "Card" }] },
      images: [],
    });
  });

  it("throws an error answer as an Error naming the function, with the tool's own text", async () => {
    await expect(bridge.call("nodesFind", { name: "missing" }, signal)).rejects.toThrow(
      "pw.nodesFind: NODE_NOT_FOUND: No layer named missing.",
    );
  });

  it("answers a tool without structuredContent by its value, its image blocks kept apart", async () => {
    expect(await bridge.call("designRead", { node: "1:2" }, signal)).toEqual({
      value: { xml: '<Frame id="1:2" />' },
      images: [{ type: "image", data: "iVBOR", mimeType: "image/png" }],
    });
  });
});
