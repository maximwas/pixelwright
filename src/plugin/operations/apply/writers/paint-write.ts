import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PAINTS } from "@/plugin/adapters/figma/paints.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { APPLY_IMAGES } from "@/plugin/operations/apply/apply-images.ts";
import { TOKEN_INDEX } from "@/plugin/operations/apply/token-index.ts";
import type { PAINT_FIELD } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { INTENT_PAINT } from "@/shared/write-intents/write-intent.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type PaintSpec = NonNullable<FigmaProps["fills"]>[number];

type PaintField = (typeof PAINT_FIELD)[keyof typeof PAINT_FIELD];

/**
 * A layer's fills or strokes as one list (P-092): a paint style is the whole list, alone and at full opacity; every
 * other token is a colour variable, a gradient stop's too; an image is made of its uploaded file (T-131). The check
 * finds the tokens without importing; the write imports a library's, sets the list unless the layer holds it, then the
 * bound paints' opacities again (FX-046).
 */
@injectable()
export class PaintWrite {
  readonly #tokens;
  readonly #paints;
  readonly #images;

  constructor(
    tokens = inject(TOKEN_INDEX),
    paints = inject(PAINTS),
    images = inject(APPLY_IMAGES),
  ) {
    this.#tokens = tokens;
    this.#paints = paints;
    this.#images = images;
  }

  async check(specs: readonly PaintSpec[]): Promise<void> {
    if ((await this.#style(specs)) !== null) {
      return;
    }

    for (const spec of specs) {
      if (spec.kind === INTENT_PAINT.token && spec.token !== undefined) {
        await this.#notStyle(spec.token);
      }
    }

    for (const token of this.#tokenNames(specs)) {
      await this.#tokens.check(token, TOKEN_KIND.colour);
    }
  }

  /** The paint style's id alone, or the layers as Figma takes them. */
  async paints(specs: readonly PaintSpec[], consumer: SceneNode): Promise<string | Paint[]> {
    const style = await this.#style(specs);

    if (style !== null) {
      return style;
    }

    const variables = new Map<string, Variable>();

    for (const token of this.#tokenNames(specs)) {
      variables.set(token, await this.#tokens.variable(token, TOKEN_KIND.colour));
    }

    const images = new Map<string, string>();

    for (const spec of specs) {
      if (spec.kind === INTENT_PAINT.image) {
        images.set(spec.stream ?? "", this.#images.hash(spec));
      }
    }

    return await this.#paints.of(specs, variables, consumer, images);
  }

  /** The list on the field unless it holds it already with no style; then the bound paints' opacities again. */
  set(
    node: SceneNode,
    field: PaintField,
    paints: Paint[],
    styled: unknown,
  ): void {
    const hasStyle = typeof styled === "string" && styled !== "";

    if (!hasStyle && this.#paints.same(Reflect.get(node, field), paints)) {
      return;
    }

    Reflect.set(node, field, paints);

    const again = this.#paints.again(Reflect.get(node, field) as Paint[], paints);

    if (again !== null) {
      Reflect.set(node, field, again);
    }
  }

  /** The paint style a single token at full opacity names, if it names one rather than a colour variable. */
  async #style(specs: readonly PaintSpec[]): Promise<string | null> {
    const [only] = specs;

    if (
      specs.length !== 1 ||
      only?.kind !== INTENT_PAINT.token ||
      only.token === undefined ||
      (only.opacity ?? 1) !== 1
    ) {
      return null;
    }

    return await this.#tokens.style(only.token, TOKEN_KIND.paint);
  }

  /** A paint style is the whole list of a layer's paints: no layer of one. */
  async #notStyle(token: string): Promise<void> {
    if ((await this.#tokens.style(token, TOKEN_KIND.paint)) !== null) {
      throw new WriteError(WRITERS_TEXT.paintStyle(token), WRITERS_TEXT.paintStyleHint);
    }
  }

  #tokenNames(specs: readonly PaintSpec[]): Set<string> {
    return new Set(
      specs.flatMap((spec) => [
        ...(spec.kind === INTENT_PAINT.token && spec.token !== undefined ? [spec.token] : []),
        ...(spec.stops ?? []).flatMap(({ token }) => (token === undefined ? [] : [token])),
      ]),
    );
  }
}

export const PAINT_WRITE = new InjectionToken<PaintWrite>("PaintWrite");
