import type { OperationInput, OperationOutput, TokenError, TokenItem } from "@pixelwright/core";
import type { FontCatalog } from "../../../figma/fonts.ts";
import { IdLookup } from "../../../figma/id-lookup.ts";
import { TokenIndex } from "../../../figma/tokens/token-index.ts";
import type { EditsGuard } from "../../../services/edits-guard.ts";
import type { ModeLimit } from "../../../services/mode-limit.ts";
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
  readonly fonts: FontCatalog;
  readonly lookup = new IdLookup();
  readonly modeLimit: ModeLimit;
  readonly #edits: EditsGuard;
  readonly #plan: OperationInput<"tokens_apply">["plan"];
  readonly #results: Required<Written> = {
    created: [],
    updated: [],
    errors: [],
    notes: [],
  };
  #index: Promise<TokenIndex> | null = null;
  #provenModes: Promise<number> | null = null;
  #wrote = false;

  constructor(
    { plan, dryRun }: OperationInput<"tokens_apply">,
    {
      edits,
      fonts,
      modeLimit,
    }: { readonly edits: EditsGuard; readonly fonts: FontCatalog; readonly modeLimit: ModeLimit },
  ) {
    this.#plan = plan;
    this.dryRun = dryRun;
    this.#edits = edits;
    this.fonts = fonts;
    this.modeLimit = modeLimit;
  }

  async run(): Promise<Written> {
    if (!this.dryRun) {
      this.#edits.require();
    }

    const file = await FileTokens.read(this.#plan);
    const known = new KnownVariables(file.raw);

    await known.addLibraryTargets(this.#plan, this);
    await new VariableWriter(this, file, known).write(this.#plan.collections);
    await new StyleWriter(this, file).write(this.#plan.styles);

    if (this.#wrote) {
      figma.commitUndo();
    }

    const { notes, ...results } = this.#results;

    return notes.length === 0 ? results : this.#results;
  }

  index(): Promise<TokenIndex> {
    this.#index ??= TokenIndex.of(this.lookup);

    return this.#index;
  }

  provenModes(): Promise<number> {
    this.#provenModes ??= figma.variables
      .getLocalVariableCollectionsAsync()
      .then((collections) => Math.max(1, ...collections.map(({ modes }) => modes.length)));

    return this.#provenModes;
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

  noted(note: string): void {
    this.#results.notes.push(note);
  }

  wrote(): void {
    this.#wrote = true;
  }
}
