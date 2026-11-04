import { inject, injectable } from "@needle-di/core";
import { TOKEN_NAMES } from "@/core/kernel/names/token-names.ts";
import { MODEL_TEXT, MODEL_VALUE } from "@/core/tokens/model/model.constants.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  STYLE_KIND,
  TOKEN_KIND,
  TOKENS_USAGE_TEXT,
  type TokenKind,
} from "@/server/tools/tokens-usage/tokens-usage.constants.ts";
import {
  type TokensUsageInput,
  TokensUsageInputSchema,
  type TokensUsageOutput,
} from "@/server/tools/tokens-usage/tokens-usage.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { USAGE_WITHIN } from "@/shared/ops/usage/usage.constants.ts";
import { usageOp } from "@/shared/ops/usage/usage.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";
import type { RawStyle, RawTokens } from "@/shared/ops/variables/variables.schema.ts";

/** The style or variable a token names. */
interface Target {
  readonly id: string;
  readonly kind: TokenKind;
  readonly name: string;
}

/**
 * tokens_usage (T-106): the token found as design_read names it, through the one naming (TokenNames) over the
 * variables op's raw tokens of the file and of the layers scanned (a library's among them), then the usage op's
 * layers that use it, at most 500, within the caller's budget (D-48): a scan the budget stopped says so in a note.
 */
@injectable()
export class TokensUsageTool extends Tool<TokensUsageInput, TokensUsageOutput> {
  protected readonly input = TokensUsageInputSchema;
  readonly #session;
  readonly #names;

  constructor(session = inject(PLUGIN_SESSION), names = inject(TOKEN_NAMES)) {
    super();
    this.#session = session;
    this.#names = names;
  }

  protected async run({ token, within, budgetMs }: TokensUsageInput): Promise<TokensUsageOutput> {
    const layer = within === undefined || within === USAGE_WITHIN.file ? {} : { within };
    const raw = await this.#session.run(variablesOp, { libraries: false, used: true, ...layer });
    const { id, kind, name } = this.#target(raw, token);
    const { layers, more, cut } = await this.#session.run(usageOp, {
      id,
      variable: kind === TOKEN_KIND.variable,
      budgetMs,
      ...(within === undefined ? {} : { within }),
    });

    return {
      token,
      kind,
      name,
      layers,
      more,
      ...(cut ? { notes: [TOKENS_USAGE_TEXT.cut(budgetMs, layers.length)] } : {}),
    };
  }

  /** The style the token names (a text style's ends in -font), else the variable; none is NODE_NOT_FOUND. */
  #target(raw: RawTokens, token: string): Target {
    for (const style of raw.styles) {
      const kind = STYLE_KIND[style.type];

      if (kind !== undefined && this.#styleToken(style, kind) === token) {
        return { id: style.id, kind, name: style.name };
      }
    }

    const variable = raw.variables.find((each) => this.#names.variable(each) === token);

    if (variable === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, TOKENS_USAGE_TEXT.notFound(token));
    }

    return { id: variable.id, kind: TOKEN_KIND.variable, name: variable.name };
  }

  /** A style's token as tokens_read writes it: a text style's font shorthand is --<name>-font. */
  #styleToken(style: RawStyle, kind: TokenKind): string {
    const token = this.#names.style(style);

    return kind === TOKEN_KIND.text ? MODEL_TEXT.part(token, MODEL_VALUE.font) : token;
  }
}
