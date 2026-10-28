import { styleValueOf, type TokensPlan } from "@pixelwright/core";
import { WriteError } from "../../../figma/write-error.ts";
import { errorMessage } from "../../../utils/error-message.ts";
import type { FileTokens } from "./file-tokens.ts";
import { sameSpec } from "./same-values.ts";
import { EFFECT_STYLES, PAINT_STYLES, type StyleKind, TEXT_STYLES } from "./style-kinds.ts";
import type { TokenRun } from "./token-run.ts";

/**
 * Writes paint, text and effect styles by name among the file's own: one whose CSS tokens_read shows the same is left
 * alone; one that differs is changed keeping what CSS cannot show; one the file lacks is made. A library's style of
 * that name is never copied. Each style that cannot be written is its own error.
 */
export class StyleWriter {
  readonly #run: TokenRun;
  readonly #file: FileTokens;

  constructor(run: TokenRun, file: FileTokens) {
    this.#run = run;
    this.#file = file;
  }

  async write(styles: TokensPlan["styles"]): Promise<void> {
    await this.#writeKind(PAINT_STYLES, styles.paint);
    await this.#writeKind(TEXT_STYLES, styles.text);
    await this.#writeKind(EFFECT_STYLES, styles.effect);
  }

  async #writeKind<Plan extends { readonly name: string }, Style extends BaseStyle, Value>(
    kind: StyleKind<Plan, Style, Value>,
    plans: readonly Plan[],
  ): Promise<void> {
    const locals = plans.length === 0 ? [] : await kind.local();

    for (const plan of plans) {
      try {
        await this.#writeStyle(kind, plan, locals);
      } catch (error) {
        // A token error's hint names the near tokens: a style's error has no field of its own for it.
        const hint = error instanceof WriteError && error.hint !== undefined ? ` ${error.hint}` : "";

        this.#run.failed({
          kind: kind.kind,
          name: plan.name,
          message: `${errorMessage(error)}${hint}`,
        });
      }
    }
  }

  async #writeStyle<Plan extends { readonly name: string }, Style extends BaseStyle, Value>(
    kind: StyleKind<Plan, Style, Value>,
    plan: Plan,
    locals: readonly Style[],
  ): Promise<void> {
    const item = {
      kind: kind.kind,
      name: plan.name,
    };
    const shown = this.#file.shownStyle(kind.kind, plan.name);

    if (shown !== undefined && sameSpec(styleValueOf(kind.kind, shown.value, shown.also), kind.spec(plan))) {
      return;
    }

    const style = locals.find((local) => local.name === plan.name) ?? null;

    if (style === null && this.#file.isLibraryStyle(kind.kind, plan.name)) {
      this.#run.failed({
        ...item,
        message: `${plan.name} comes from a library: change it there.`,
      });

      return;
    }

    const next = await kind.next(plan, style, this.#run);

    if (style !== null && kind.holds(style, next)) {
      return;
    }

    if (!this.#run.dryRun) {
      kind.write(style ?? named(kind.make(), plan.name), next);
      this.#run.wrote();
    }

    if (style === null) {
      this.#run.created(item);
    } else {
      this.#run.updated(item);
    }
  }
}

function named<Style extends BaseStyle>(style: Style, name: string): Style {
  style.name = name;

  return style;
}
