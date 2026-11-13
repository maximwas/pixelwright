import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import { type StyleGroup, TOKEN_FACTORY } from "@/plugin/adapters/figma/variables/token-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { STYLE_LOOKS } from "@/plugin/operations/tokens-apply/style-looks.ts";
import { TEXT_STYLE_LOOKS } from "@/plugin/operations/tokens-apply/text-style-looks.ts";
import { TOKENS_APPLY_TEXT } from "@/plugin/operations/tokens-apply/tokens-apply.constants.ts";
import type { Targets, TokenRun } from "@/plugin/operations/tokens-apply/tokens-apply.types.ts";
import { TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { StylePlans } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

/** How a planned style is written to its Figma style; null when nothing is (a dry run). */
type StyleWrite = ((style: BaseStyle) => Promise<void> | void) | null;

/** What a planned style becomes, given the style it changes (none for a new one). */
type Look<Plan> = (plan: Plan, held: BaseStyle | null) => Promise<StyleWrite>;

/**
 * The planned paint, text and effect styles (C-173, T-166): each the file's own by id or made with its name, its look
 * worked out first, so a refused one leaves no empty style behind; each refusal is that style's error while the rest
 * is written. Core planned only what differs, and never a library's style.
 */
@injectable()
export class StyleWriter {
  readonly #factory;
  readonly #looks;
  readonly #texts;
  readonly #layers;

  constructor(
    factory = inject(TOKEN_FACTORY),
    looks = inject(STYLE_LOOKS),
    texts = inject(TEXT_STYLE_LOOKS),
    layers = inject(LAYER_FACTORY),
  ) {
    this.#factory = factory;
    this.#looks = looks;
    this.#texts = texts;
    this.#layers = layers;
  }

  async write(
    styles: StylePlans,
    targets: Targets,
    run: TokenRun,
  ): Promise<void> {
    this.#texts.start();
    await this.#group(TOKEN_KIND.paint, styles.paint, run, async (plan) => {
      const paints = await this.#looks.paints(plan, targets, run);

      return paints === null
        ? null
        : (style) => {
          Object.assign(style, { paints });
        };
    });
    await this.#group(TOKEN_KIND.text, styles.text, run, async (plan, held) => {
      const look = await this.#texts.text(plan, held as TextStyle | null);

      if (run.dryRun) {
        return null;
      }

      // Loaded before the style is made: a font Figma refuses leaves no empty style behind.
      await this.#layers.loadFont(look.fontName);

      return (style) => {
        Object.assign(style, look);
      };
    });
    await this.#group(TOKEN_KIND.effect, styles.effect, run, async (plan, held) => {
      const effects = await this.#looks.effects(plan, (held as EffectStyle | null)?.effects ?? [], targets, run);

      return effects === null
        ? null
        : (style) => {
          Object.assign(style, { effects });
        };
    });
  }

  async #group<Plan extends { readonly name: string; readonly id?: string }>(
    group: StyleGroup,
    plans: readonly Plan[],
    run: TokenRun,
    look: Look<Plan>,
  ): Promise<void> {
    if (plans.length === 0) {
      return;
    }

    const local = new Map((await this.#factory.styles(group)).map((style) => [style.id, style]));

    for (const plan of plans) {
      const item = { kind: group, name: plan.name };

      try {
        const held = plan.id === undefined ? null : (local.get(plan.id) ?? null);

        if (plan.id !== undefined && held === null) {
          throw new WriteError(TOKENS_APPLY_TEXT.gone(plan.name));
        }

        const write = await look(plan, held);

        if (write !== null) {
          const style = held ?? this.#factory.style(group, plan.name);

          // A style made is a write, whether or not it then takes its value: the undo step covers it.
          run.wrote = true;
          await write(style);
        }

        (held === null ? run.answer.created : run.answer.updated).push(item);
      } catch (error) {
        run.answer.errors.push({ ...item, message: this.#message(error) });
      }
    }
  }

  /** A refusal's words, with what to do instead when it says (a font's near family). */
  #message(error: unknown): string {
    if (error instanceof WriteError && error.hint !== undefined) {
      return TOKENS_APPLY_TEXT.hinted(error.message, error.hint);
    }

    return error instanceof Error ? error.message : String(error);
  }
}

export const STYLE_WRITER = new InjectionToken<StyleWriter>("StyleWriter");
