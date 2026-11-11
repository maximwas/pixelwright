import { inject, injectable } from "@needle-di/core";
import type { Tokens } from "@/core/tokens/model/model.schema.ts";
import { MODEL_SUMMARY } from "@/core/tokens/model/model-summary.ts";
import { TOKEN_MODEL } from "@/core/tokens/model/token-model.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOKEN_WRITER } from "@/server/tools/tokens-read/token-writer.ts";
import { TOKEN_FORMAT_FIELD, TOKENS_READ, TOKENS_READ_TEXT } from "@/server/tools/tokens-read/tokens-read.constants.ts";
import {
  type TokensReadInput,
  TokensReadInputSchema,
  type TokensReadOutput,
} from "@/server/tools/tokens-read/tokens-read.schema.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * tokens_read (T-160, T-161, T-162): the variables op's raw tokens made into core's token model on the server and
 * written as CSS, as the model itself with format json, or as DTCG trees with their own notes (K-013). Notes say what could not be written, why the libraries are
 * missing or add nothing, and which collections asked for do not exist; past maxChars come the summary, the first
 * whole tokens that fit, and a note naming the collections to read one at a time.
 */
@injectable()
export class TokensReadTool extends Tool<TokensReadInput, TokensReadOutput> {
  protected readonly input = TokensReadInputSchema;
  readonly #session;
  readonly #model;
  readonly #writer;
  readonly #summary;

  constructor(
    session = inject(PLUGIN_SESSION),
    model = inject(TOKEN_MODEL),
    writer = inject(TOKEN_WRITER),
    summary = inject(MODEL_SUMMARY),
  ) {
    super();
    this.#session = session;
    this.#model = model;
    this.#writer = writer;
    this.#summary = summary;
  }

  protected async run({
    collections,
    query,
    libraries,
    used,
    within,
    format,
    maxChars,
  }: TokensReadInput): Promise<TokensReadOutput> {
    const raw = await this.#session.run(variablesOp, { libraries, used, ...(within === undefined ? {} : { within }) });
    const { notes: unwritten, ...tokens } = this.#model.model(
      raw,
      collections,
      query === undefined ? undefined : [query].flat(),
    );
    const written = this.#writer.written(format, raw, tokens, tokens);
    const notes = [...(written.notes ?? unwritten), ...this.#readingNotes(raw, collections)];
    const library = raw.library === undefined ? {} : { library: raw.library };

    if (written.size <= maxChars) {
      return { format, ...written.body, ...library, notes };
    }

    // A design system can be thousands of variables: past maxChars the client gets the map, the first whole tokens
    // that fit, and the collections to ask for one at a time.
    const first = this.#summary.first(tokens, maxChars, (part) => this.#writer.written(format, raw, part, tokens).size);
    const shown = { field: TOKEN_FORMAT_FIELD[format], shown: first.shown, total: first.total };

    return {
      format,
      ...this.#writer.written(format, raw, first.tokens, tokens).body,
      summary: this.#summary.count(tokens),
      ...library,
      notes: [...notes, TOKENS_READ_TEXT.tooLong(written.size, maxChars, shown, this.#parts(tokens))],
    };
  }

  /**
   * What the read itself says: why the libraries are missing, cut or add nothing, that the scan for the used tokens
   * was cut, and collections that do not exist.
   */
  #readingNotes(raw: RawTokens, collections: readonly string[] | undefined): string[] {
    const known = new Set(raw.collections.map(({ name }) => name.toLowerCase()));
    const missing = (collections ?? []).filter((name) => !known.has(name.toLowerCase()));

    return [
      ...(raw.libraryNote === undefined ? [] : [raw.libraryNote]),
      ...(raw.usedCut === undefined ? [] : [TOKENS_READ_TEXT.usedCut]),
      ...(raw.library?.length === 0 && raw.libraryNote === undefined ? [TOKENS_READ_TEXT.noLibrary] : []),
      ...(missing.length === 0
        ? []
        : [
          TOKENS_READ_TEXT.noCollection(
            missing,
            raw.collections.map(({ name }) => name),
          ),
        ]),
    ];
  }

  /** The collections a too-long read can be split into, the first few. */
  #parts(tokens: Tokens): string[] {
    return tokens.collections.slice(0, TOKENS_READ.partsNamed).map(({ name }) => name);
  }
}
