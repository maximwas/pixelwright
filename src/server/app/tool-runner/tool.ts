import * as zod from "zod/mini";
import type { ToolAnswer } from "./tool-runner.types.ts";

export type ToolOutput = Readonly<Record<string, unknown>>;

/**
 * One tool call (Command), built for that call and run once. execute() is the template every tool follows: the input
 * the SDK has checked is typed by the tool's schema, run() does the tool's work, answer() shapes what the client gets.
 */
export abstract class Tool<Input = unknown, Output extends ToolOutput = ToolOutput> {
  protected abstract readonly input: zod.ZodMiniType<Input>;

  async execute(args: unknown): Promise<ToolAnswer> {
    // The SDK has validated args against this very schema; parsing again only gives them their type.
    return this.answer(await this.run(zod.parse(this.input, args)));
  }

  protected abstract run(input: Input): Promise<Output>;

  /** structuredContent plus the same JSON as text: Claude Code shows the model only structuredContent (T-004). */
  protected answer(output: Output): ToolAnswer {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(output),
        },
      ],
      structuredContent: output,
    };
  }
}
