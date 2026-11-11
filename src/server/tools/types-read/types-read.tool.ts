import { injectable } from "@needle-di/core";
import { uniqBy } from "es-toolkit";
import { CODE_TEXT } from "@/server/app/code-mode/code-mode.constants.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import ANSWER_TYPES from "@/server/tools/types-read/data/answer-types.json" with { type: "json" };
import {
  type AnswerType,
  type TypesReadInput,
  TypesReadInputSchema,
  type TypesReadOutput,
} from "@/server/tools/types-read/types-read.schema.ts";

/**
 * Each read's whole answer type as TypeScript, for a script (execute script): written at build time from the tools'
 * output schemas (`pnpm build:pw`, data/answer-types.json), by hand for design_read and screenshot, which have none. A
 * read is named by its tool's name or as a script calls it; the names that are none are listed, not thrown.
 */
@injectable()
export class TypesReadTool extends Tool<TypesReadInput, TypesReadOutput> {
  protected readonly input = TypesReadInputSchema;
  readonly #types: readonly AnswerType[] = ANSWER_TYPES;

  protected async run({ tools }: TypesReadInput): Promise<TypesReadOutput> {
    const named = tools.map((name) => [name, this.#type(name)] as const);

    return {
      types: uniqBy(
        named.flatMap(([, type]) => type ?? []),
        ({ tool }) => tool,
      ),
      unknown: named.flatMap(([name, type]) => (type === undefined ? [name] : [])),
    };
  }

  #type(name: string): AnswerType | undefined {
    return this.#types.find(({ tool, call }) => tool === name || call === name || call === CODE_TEXT.call(name));
  }
}
