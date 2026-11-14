import { inject, injectable } from "@needle-di/core";
import type { BindResult } from "@/core/tokens/bind/bind.schema.ts";
import type { BindPlanned } from "@/core/tokens/bind/bind.types.ts";
import { TOKENS_BIND } from "@/core/tokens/bind/tokens-bind.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import { BIND_INSTANCES, NO_SCAN, TOKENS_BIND_SUMMARY } from "@/server/tools/tokens-bind/tokens-bind.constants.ts";
import {
  type TokensBindInput,
  TokensBindInputSchema,
  type TokensBindOutput,
} from "@/server/tools/tokens-bind/tokens-bind.schema.ts";
import { bindOp } from "@/shared/ops/bind/bind.manifest.ts";
import { bindWriteOp } from "@/shared/ops/bind/bind-write.manifest.ts";
import { variablesOp } from "@/shared/ops/variables/variables.manifest.ts";

/**
 * tokens_bind (T-167): the tokens the layers can take, read through the variables op (the file's own and those the
 * layers under `within`, every page's with "file", or the current page's, use), core's index over them, the plugin's
 * scan of the raw values, then core's plan: the answer, summed up in one sentence here, and every use a real run binds.
 * A dry run is that plan, read with Allow edits off; a real run is the same plan written by the bind_write op through
 * the versioned write (a version waits for the plan to bind something), what Figma refused among the errors.
 */
@injectable()
export class TokensBindTool extends WriteTool<TokensBindInput, BindPlanned, BindResult, TokensBindOutput> {
  protected readonly input = TokensBindInputSchema;
  protected readonly op = bindWriteOp;
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

  protected async prepare(input: TokensBindInput): Promise<BindPlanned> {
    const within = input.within === undefined ? {} : { within: input.within };
    const raw = await this.session.run(variablesOp, { libraries: false, used: true, ...within });
    const index = this.#bind.index(raw);
    const remap = index.sources(input.remap);
    // No from token names a style or variable: an empty remap list would make the op scan every raw value instead.
    const scan =
      input.remap.length > 0 && remap.length === 0
        ? NO_SCAN
        : await this.session.run(bindOp, {
          ...within,
          kinds: input.kinds,
          remap,
          overrides: input.remap.length > 0 && input.instances === BIND_INSTANCES.override,
        });

    return this.#bind.plan(index, scan, input);
  }

  /** A dry run is the plan itself, written nowhere: a version is probed with it first. */
  protected override probes(): boolean {
    return true;
  }

  /** The plan's answer; on a real run with something to bind, after the writer, its failures among the errors. */
  protected async write({ result, plan }: BindPlanned, dry: boolean): Promise<BindResult> {
    if (dry || plan.binds.length + plan.remaps.length === 0) {
      return result;
    }

    const { failed } = await this.session.run(bindWriteOp, plan);

    return { ...result, errors: [...result.errors, ...failed] };
  }

  protected changes({ layers }: BindResult): number {
    return layers;
  }

  /** The answer, grouped by value: the per-use plan went to the writer. */
  protected output(result: BindResult, fields: WriterOutput): TokensBindOutput {
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
