import type { OperationInput, OperationOutput, TokenError, TokenItem } from "@pixelwright/core";
import { requireEdits } from "../../../figma/edits.ts";
import { TokenIndex } from "../../../figma/tokens/token-index.ts";
import { FileTokens } from "./file-tokens.ts";
import { KnownVariables } from "./known-variables.ts";
import { StyleWriter } from "./styles.ts";
import type { TokenRun } from "./token-run.ts";
import { VariableWriter } from "./variables.ts";

type Written = OperationOutput<"tokens_apply">;

/**
 * tokens_apply as one command: reads what the file holds once, writes the planned collections, variables and styles,
 * and records what it made, changed and could not write. Everything it writes is one undo step. A dry run goes the
 * same way without writing, so it needs no Allow edits.
 */
export class TokenWriter implements TokenRun {
  readonly dryRun: boolean;
  readonly #plan: OperationInput<"tokens_apply">["plan"];
  readonly #results: Written = {
    created: [],
    updated: [],
    errors: [],
  };
  #index: Promise<TokenIndex> | null = null;
  #wrote = false;

  constructor({ plan, dryRun }: OperationInput<"tokens_apply">) {
    this.#plan = plan;
    this.dryRun = dryRun;
  }

  async run(): Promise<Written> {
    if (!this.dryRun) {
      requireEdits();
    }

    const file = await FileTokens.read(this.#plan);
    const known = new KnownVariables(file.raw);

    await known.addLibraryTargets(this.#plan, this);
    await new VariableWriter(this, file, known).write(this.#plan.collections);
    await new StyleWriter(this, file).write(this.#plan.styles);

    if (this.#wrote) {
      figma.commitUndo();
    }

    return this.#results;
  }

  index(): Promise<TokenIndex> {
    this.#index ??= TokenIndex.of();

    return this.#index;
  }

  created(item: TokenItem): void {
    this.#results.created.push(item);
  }

  updated(item: TokenItem): void {
    this.#results.updated.push(item);
  }

  failed(error: TokenError): void {
    this.#results.errors.push(error);
  }

  wrote(): void {
    this.#wrote = true;
  }
}
