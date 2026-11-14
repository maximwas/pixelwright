import { inject, injectable } from "@needle-di/core";
import type { BindResult } from "@/core/tokens/bind/bind.schema.ts";
import type { BindPlanned } from "@/core/tokens/bind/bind.types.ts";
import type { BindIndex } from "@/core/tokens/bind/bind-index.ts";
import { TOKENS_BIND } from "@/core/tokens/bind/tokens-bind.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import {
  BIND_INSTANCES,
  NO_SCAN,
  TOKENS_BIND_SUMMARY,
  TOKENS_BIND_TEXT,
} from "@/server/tools/tokens-bind/tokens-bind.constants.ts";
import {
  type TokensBindInput,
  TokensBindInputSchema,
  type TokensBindOutput,
} from "@/server/tools/tokens-bind/tokens-bind.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { bindOp } from "@/shared/ops/bind/bind.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

/** The call, and the file's tokens by the values they hold. */
interface Prepared {
  readonly input: TokensBindInput;
  readonly index: BindIndex;
}

/**
 * tokens_bind (T-167): the tokens the layers can take, read through the variables op (the file's own and those the
 * layers under `within`, every page's with "file", or the current page's, use), core's index over them, the plugin's
 * scan of the raw values, then core's plan: the answer, summed up in one sentence here, and the per-use plan item 51's
 * writer op takes. A real run is refused before anything is read: the plugin binds with item 51.
 */
@injectable()
export class TokensBindTool extends WriteTool<TokensBindInput, Prepared, BindPlanned, TokensBindOutput> {
  protected readonly input = TokensBindInputSchema;
  // shortcut: the scan is a read with no dry run to probe; item 51's writer op takes its place here.
  protected readonly op = bindOp;
  readonly #bind;

  constructor(
    session = inject(PLUGIN_SESSION),
    versioned = inject(VERSIONED_WRITE),
    support = inject(SUPPORT_NOTE),
    bind = inject(TOKENS_BIND),
  ) {
    super(session, versioned, support);
    this.#bind = bind;
  }

  protected async prepare(input: TokensBindInput): Promise<Prepared> {
    if (!input.dryRun) {
      throw new PixelwrightError(ERROR_CODE.opFailed, TOKENS_BIND_TEXT.dryOnly);
    }

    const within = input.within === undefined ? {} : { within: input.within };
    const raw = await this.session.run(variablesOp, { libraries: false, used: true, ...within });

    return { input, index: this.#bind.index(raw) };
  }

  protected async write({ input, index }: Prepared): Promise<BindPlanned> {
    const remap = index.sources(input.remap);
    // No from token names a style or variable: an empty remap list would make the op scan every raw value instead.
    const scan =
      input.remap.length > 0 && remap.length === 0
        ? NO_SCAN
        : await this.session.run(bindOp, {
          ...(input.within === undefined ? {} : { within: input.within }),
          kinds: input.kinds,
          remap,
          overrides: input.remap.length > 0 && input.instances === BIND_INSTANCES.override,
        });

    return this.#bind.plan(index, scan, input);
  }

  protected changes({ result }: BindPlanned): number {
    return result.layers;
  }

  /** The answer, grouped by value: the per-use plan stays with the writer. */
  protected output({ result }: BindPlanned, fields: WriterOutput): TokensBindOutput {
    return { ...result, summary: this.#summary(result, fields.dry ?? false), ...fields };
  }

  /** What was bound (or would be), what waits for a pick and what no token holds, in one sentence. */
  #summary({ bound, ambiguous, unmatched, remapped, layers, errors, more }: BindResult, dry: boolean): string {
    const done =
      remapped.length > 0
        ? TOKENS_BIND_SUMMARY.rebound(dry, this.#uses(remapped))
        : TOKENS_BIND_SUMMARY.bound(dry, this.#uses(bound));
    const parts = [
      TOKENS_BIND_SUMMARY.on(done, layers),
      ambiguous.length > 0 ? TOKENS_BIND_SUMMARY.ambiguous(ambiguous.length) : null,
      unmatched.length > 0 ? TOKENS_BIND_SUMMARY.unmatched(unmatched.length) : null,
      errors.length > 0 ? TOKENS_BIND_SUMMARY.errors(errors.length) : null,
      more ? TOKENS_BIND_SUMMARY.more : null,
    ];

    return TOKENS_BIND_SUMMARY.sentence(parts.filter((part) => part !== null));
  }

  #uses(groups: readonly { readonly count: number }[]): number {
    return groups.reduce((sum, { count }) => sum + count, 0);
  }
}
