import { inject, injectable } from "@needle-di/core";
import { TOKENS_CSS } from "@/core/tokens/formats/css/tokens-css.ts";
import type { ReadyTokens } from "@/core/tokens/model/model.schema.ts";
import { TOKEN_MODEL } from "@/core/tokens/model/token-model.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOKENS_READ, TOKENS_READ_TEXT } from "@/server/tools/tokens-read/tokens-read.constants.ts";
import {
  type TokensReadInput,
  TokensReadInputSchema,
  type TokensReadOutput,
} from "@/server/tools/tokens-read/tokens-read.schema.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";
import type { RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/**
 * tokens_read (T-160): the variables op's raw tokens made into core's token model on the server and written as CSS.
 * Notes say what could not be written, why the libraries are missing, and which collections asked for do not exist;
 * past maxChars the CSS is left out and a note names the collections to read one at a time.
 */
@injectable()
export class TokensReadTool extends Tool<TokensReadInput, TokensReadOutput> {
  protected readonly input = TokensReadInputSchema;
  readonly #session;
  readonly #model;
  readonly #css;

  constructor(
    session = inject(PLUGIN_SESSION),
    model = inject(TOKEN_MODEL),
    css = inject(TOKENS_CSS),
  ) {
    super();
    this.#session = session;
    this.#model = model;
    this.#css = css;
  }

  protected async run({
    collections,
    libraries,
    used,
    within,
    format,
    maxChars,
  }: TokensReadInput): Promise<TokensReadOutput> {
    const raw = await this.#session.run(variablesOp, { libraries, used, ...(within === undefined ? {} : { within }) });
    const tokens = this.#model.model(raw, collections);
    const css = this.#css.write(tokens);
    const notes = [...tokens.notes, ...this.#readingNotes(raw, collections)];
    const library = raw.library === undefined ? {} : { library: raw.library };

    if (css.length > maxChars) {
      return {
        format,
        ...library,
        notes: [...notes, TOKENS_READ_TEXT.tooLong(css.length, maxChars, this.#parts(tokens))],
      };
    }

    return { format, css, ...library, notes };
  }

  /** What the read itself says: why the libraries are missing or cut, and collections asked for that do not exist. */
  #readingNotes(raw: RawTokens, collections: readonly string[] | undefined): string[] {
    const known = new Set(raw.collections.map(({ name }) => name.toLowerCase()));
    const missing = (collections ?? []).filter((name) => !known.has(name.toLowerCase()));

    return [
      ...(raw.libraryNote === undefined ? [] : [raw.libraryNote]),
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
  #parts(tokens: ReadyTokens): string[] {
    return tokens.collections.slice(0, TOKENS_READ.partsNamed).map(({ name }) => name);
  }
}
