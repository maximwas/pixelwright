import { InjectionToken, inject, injectable } from "@needle-di/core";
import { get, set } from "es-toolkit/compat";
import * as zod from "zod/mini";
import type { AnswerShape } from "@/core/ports/code-sandbox.port.ts";
import { ANSWER_SHAPES } from "@/server/app/code-mode/answer-shapes.ts";
import { BOUND_ISSUE, CODE_TEXT } from "@/server/app/code-mode/code-mode.constants.ts";
import { PW_TOOLS } from "@/server/app/code-mode/code-mode.tokens.ts";
import type { Clamp, ToolImage } from "@/server/app/code-mode/code-mode.types.ts";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import { TOOL_RUNNER, type ToolContent } from "@/server/app/tool-runner/tool-runner.ts";

/** A pw call's plain value, the image blocks its tool answered with (kept apart for the run's handles), its clamps. */
export interface PwAnswer {
  readonly value: Readonly<Record<string, unknown>>;
  readonly images: readonly ToolImage[];
  readonly clamped?: readonly Clamp[];
}

/** Where a number passed its bound, and the bound. */
type Bound = { readonly path: readonly PropertyKey[]; readonly used: number };

/** A zod issue as the bridge reads it: where, its message, and the keys refused or the type expected. */
type Issue = {
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly keys?: readonly string[];
  readonly expected?: string;
};

/** pw's functions as a run calls them. */
export interface PwCalls {
  names(): readonly string[];
  shapes(): Readonly<Record<string, AnswerShape>>;
  /** `file` is the file the call reads when its own arguments name none. */
  call(name: string, args: unknown, signal: AbortSignal, file?: string): Promise<PwAnswer>;
}

/**
 * pw over the tool runner: `pw.<name>(args)` is that tool's call. The MCP SDK checks a client's arguments before the
 * runner; code's are checked here, with the tool's own input schema, so an error names the function and each wrong
 * path, and a refused key with the keys there are. A number past its bound is first set to the bound: a refusal costs
 * the model a turn, and strict tool use does not enforce bounds either; the answer lists it. The call then goes
 * through the runner like any other (TargetStep, timers, logs), and its answer comes back as a plain value:
 * structuredContent, or the value a text-block tool gives code (design_read); an error answer is a thrown Error naming
 * the function, which the code can catch.
 */
@injectable()
export class PwBridge implements PwCalls {
  readonly #runner;
  readonly #tools;
  readonly #shaper;
  #shapes: Readonly<Record<string, AnswerShape>> | undefined;

  constructor(
    runner = inject(TOOL_RUNNER),
    tools = inject(PW_TOOLS),
    shaper = inject(ANSWER_SHAPES),
  ) {
    this.#runner = runner;
    this.#tools = tools;
    this.#shaper = shaper;
  }

  names(): readonly string[] {
    return [...this.#tools.keys()];
  }

  /** Each function's answer shape from its tool's outputSchema, worked out at the first run. */
  shapes(): Readonly<Record<string, AnswerShape>> {
    this.#shapes ??= Object.fromEntries(
      [...this.#tools].flatMap(([name, { output }]) => {
        const shape = this.#shaper.shape(output);

        return shape === undefined ? [] : [[name, shape] as const];
      }),
    );

    return this.#shapes;
  }

  async call(
    name: string,
    args: unknown,
    signal: AbortSignal,
    file?: string,
  ): Promise<PwAnswer> {
    const manifest = this.#tools.get(name);

    if (manifest === undefined) {
      throw new Error(CODE_TEXT.unknown(name));
    }

    const bounded = this.#clamped(name, manifest.input, this.#filed(manifest.input, args, file));
    const parsed = zod.safeParse(manifest.input, bounded.args);

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => this.#issue(issue, manifest.input));

      throw new Error(CODE_TEXT.failed(name, issues.join(CODE_TEXT.issueSeparator)));
    }

    const answer = await this.#runner.run({ manifest, args: parsed.data, signal });
    const text = answer.content
      .flatMap((block) => (block.type === TOOL_CONTENT_TYPE.text ? [block.text] : []))
      .join(CODE_TEXT.lineBreak);

    if (answer.isError ?? false) {
      throw new Error(CODE_TEXT.failed(name, text));
    }

    return {
      value: answer.value ?? answer.structuredContent ?? { text },
      images: answer.content.filter(this.#image),
      ...(bounded.clamped.length === 0 ? {} : { clamped: bounded.clamped }),
    };
  }

  /** The arguments with the run's file in them when the tool takes a file and they name none. */
  #filed(
    input: zod.ZodMiniObject,
    args: unknown,
    file: string | undefined,
  ): unknown {
    const plain = typeof args === "object" && args !== null && !Array.isArray(args);

    return file !== undefined &&
      plain &&
      CODE_TEXT.file in input.shape &&
      (args as Record<string, unknown>)[CODE_TEXT.file] === undefined
      ? { ...args, [CODE_TEXT.file]: file }
      : args;
  }

  /** The arguments with each number past its bound set to the bound, and what was set; unchanged when none was. */
  #clamped(
    name: string,
    input: zod.ZodMiniObject,
    args: unknown,
  ): { readonly args: unknown; readonly clamped: readonly Clamp[] } {
    const checked = zod.safeParse(input, args);
    const bounds = checked.success ? [] : checked.error.issues.flatMap((issue) => this.#bound(issue));

    if (bounds.length === 0) {
      return { args, clamped: [] };
    }

    const copy = structuredClone(args);
    const clamped = bounds.map(({ path, used }) => {
      const given = Number(get(copy, path));

      set(copy as object, path, used);

      return { call: CODE_TEXT.call(name), path: path.map(String).join(CODE_TEXT.pathSeparator), given, used };
    });

    return { args: copy, clamped };
  }

  /** A number's inclusive bound from its refusal; no other refusal has one. */
  #bound(issue: zod.core.$ZodIssue): Bound[] {
    if (issue.code === BOUND_ISSUE.tooBig && this.#number(issue)) {
      return [{ path: issue.path, used: Number(issue.maximum) }];
    }

    return issue.code === BOUND_ISSUE.tooSmall && this.#number(issue)
      ? [{ path: issue.path, used: Number(issue.minimum) }]
      : [];
  }

  #number({ origin, inclusive }: { readonly origin: string; readonly inclusive?: boolean }): boolean {
    return (BOUND_ISSUE.origins as readonly string[]).includes(origin) && (inclusive ?? true);
  }

  /** zod/mini's messages say only "Invalid input": the keys refused (and those there are) and the type expected. */
  #issue({ path, message, ...detail }: Issue, input: zod.ZodMiniObject): string {
    const where = path.map(String).join(CODE_TEXT.pathSeparator);

    if (detail.keys !== undefined) {
      const refused = CODE_TEXT.unrecognized(detail.keys);

      // The keys there are, for the top level only: a nested object's are not the input's.
      return CODE_TEXT.issue(
        where,
        path.length === 0 ? CODE_TEXT.accepted(refused, Object.keys(input.shape)) : refused,
      );
    }

    return CODE_TEXT.issue(where, detail.expected === undefined ? message : CODE_TEXT.expected(detail.expected));
  }

  #image(block: ToolContent): block is ToolImage {
    return block.type === TOOL_CONTENT_TYPE.image;
  }
}

export const PW_BRIDGE = new InjectionToken<PwCalls>("PwBridge");
