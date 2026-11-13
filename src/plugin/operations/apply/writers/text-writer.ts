import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { CAPABILITY_TEXT, CAPABILITY_TYPES, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import type { TextLayer } from "@/plugin/adapters/figma/layer-factory.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_FONTS } from "@/plugin/operations/apply/apply-fonts.ts";
import type { Refusal } from "@/plugin/operations/apply/checks.ts";
import { TEXT_LOOK } from "@/plugin/operations/apply/writers/text-look.ts";
import { TEXT_RUNS } from "@/plugin/operations/apply/writers/text-runs.ts";
import {
  TEXT_BASE_FIELDS,
  TEXT_BOX_KEYS,
  TEXT_FIGMA,
  TEXT_OWN,
  TEXT_RUN_FIELDS,
  WRITERS_TEXT,
} from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Fail = (error: unknown, keys?: readonly (keyof FigmaProps)[]) => void;

type Run = NonNullable<ApplyChangeData["text"]>["runs"][number];

/**
 * A text's characters, its own look, its Spans and its box's text settings (T-141, P-152), after the steps. New
 * characters keep the look the text had (its longest run's); its own properties go to the runs that had its own value,
 * as CSS inherits; the Spans then set theirs. Each part on its own: one that fails leaves the others. A text on a path
 * is written the same, with its start along the path and without what only a text has (FX-043).
 */
@injectable()
export class TextWriter {
  readonly #fonts;
  readonly #look;
  readonly #runs;
  readonly #assign;

  constructor(
    fonts = inject(APPLY_FONTS),
    look = inject(TEXT_LOOK),
    runs = inject(TEXT_RUNS),
    assign = inject(ASSIGN),
  ) {
    this.#fonts = fonts;
    this.#look = look;
    this.#runs = runs;
    this.#assign = assign;
  }

  /** The call's fonts: found on both runs, loaded up front on a real one (P-148). */
  async prepare(changes: readonly ApplyChangeData[], dry: boolean): Promise<void> {
    await this.#fonts.start(changes, dry);
  }

  /**
   * What the text refuses before any write, on dry and real runs alike: what only the other kind of text layer has, a
   * font or text style this Figma lacks ("Did you mean"), a colour token the file lacks; a Span's by its index.
   */
  async checks(
    change: ApplyChangeData,
    layer: TypedLayer,
    refused: ReadonlySet<keyof FigmaProps>,
  ): Promise<Refusal[]> {
    if (!(CAPABILITY_TYPES.text as readonly string[]).includes(layer.type)) {
      return [];
    }

    const found = this.#own(layer, change.props);

    for (const { key, error } of await this.#runs.check(change.props)) {
      if (!refused.has(key)) {
        found.push({ error, keys: [key] });
      }
    }

    for (const [span, run] of (change.text?.runs ?? []).entries()) {
      found.push(...this.#own(layer, run.props).map((refusal) => ({ ...refusal, span })));

      for (const { key, error } of await this.#runs.check(run.props)) {
        found.push({ error, keys: [key], span });
      }
    }

    return found;
  }

  /** What these props set that only the other kind of text layer has. */
  #own(layer: TypedLayer, props: FigmaProps): Refusal[] {
    const found: Refusal[] = [];

    for (const [key, [type, what]] of Object.entries(TEXT_OWN)) {
      if (props[key as keyof typeof TEXT_OWN] !== undefined && layer.type !== type) {
        const error = new WriteError(CAPABILITY_TEXT.refusal(CAPABILITY_TEXT.type(layer.type), what));

        found.push({ error, keys: [key as keyof typeof TEXT_OWN] });
      }
    }

    return found;
  }

  /** Whether anything went in; the checks' refusals are not written. */
  async write(
    node: SceneNode,
    change: ApplyChangeData,
    refusals: readonly Refusal[],
    fail: Fail,
  ): Promise<boolean> {
    const text = node as TextLayer;
    const refused = new Set(refusals.flatMap(({ keys, span }) => (span === undefined ? keys : [])));
    let wrote = false;

    if (change.text !== undefined) {
      try {
        wrote = await this.#characters(text, change.text.characters);
      } catch (error) {
        fail(error);

        return false;
      }
    }

    const own = await this.#ownLook(text, change.props, refused, fail);
    const runs = await this.#spans(text, change.text?.runs ?? [], refusals, fail);

    return this.#box(text, change.props, refused, fail) || runs || own || wrote;
  }

  /**
   * The characters, when they changed, the text's fonts loaded first (FX-040). New ones take the first one's look; a
   * text of several runs takes its longest run's again over all of it, so a Span removed or moved leaves nothing behind.
   */
  async #characters(node: TextLayer, characters: string): Promise<boolean> {
    const segments = node.getStyledTextSegments([...TEXT_BASE_FIELDS]);
    const base = this.#look.longest(segments);
    const retyped = node.characters !== characters;

    if (retyped) {
      const unloaded = this.#fonts.unloadedIn(node);

      if (unloaded !== undefined) {
        throw new WriteError(WRITERS_TEXT.unloaded(unloaded.family, unloaded.style), WRITERS_TEXT.unloadedHint);
      }

      this.#setCharacters(node, characters);
    }

    if (segments.length > 1 && base !== undefined && node.characters.length > 0) {
      await this.#look.restore(node, base);
    }

    return retyped || segments.length > 1;
  }

  /**
   * Through the component property the text is bound to, when an instance above it holds that property (written on the
   * text they would not stick); else on the text itself, an override inside an instance (P-152).
   */
  #setCharacters(node: TextLayer, characters: string): void {
    const key = node.componentPropertyReferences?.characters;

    for (let at = node.parent; key !== undefined && at !== null; at = at.parent) {
      if (at.type === FIGMA_NODE_TYPE.instance && Object.hasOwn(at.componentProperties, key)) {
        at.setProperties({ [key]: characters });

        return;
      }

      // A main component's own layer is its own: no instance above it is its owner.
      if (at.type === FIGMA_NODE_TYPE.component || at.type === FIGMA_NODE_TYPE.componentSet) {
        break;
      }
    }

    this.#assign.set(node, { characters });
  }

  /** The text's own properties, over the runs that had its own value. */
  async #ownLook(
    node: TextLayer,
    props: FigmaProps,
    refused: ReadonlySet<keyof FigmaProps>,
    fail: Fail,
  ): Promise<boolean> {
    let wrote = false;

    for (const [key, fields] of TEXT_RUN_FIELDS) {
      if (props[key] !== undefined && !refused.has(key)) {
        try {
          await this.#look.inherit(
            node,
            fields,
            async (start, end) => await this.#runs.write(key, { node, start, end }, props),
          );
          wrote = true;
        } catch (error) {
          fail(error, [key]);
        }
      }
    }

    return wrote;
  }

  /** What each Span sets over its characters, but for the keys its refusals name. */
  async #spans(
    node: TextLayer,
    runs: readonly Run[],
    refusals: readonly Refusal[],
    fail: Fail,
  ): Promise<boolean> {
    let wrote = false;

    for (const [index, run] of runs.entries()) {
      const skipped = new Set(refusals.flatMap(({ keys, span }) => (span === index ? keys : [])));

      for (const [key] of TEXT_RUN_FIELDS) {
        try {
          if (run.end > run.start && run.props[key] !== undefined && !skipped.has(key)) {
            await this.#runs.write(key, { node, start: run.start, end: run.end }, run.props);
            wrote = true;
          }
        } catch (error) {
          fail(error, [key]);
        }
      }
    }

    return wrote;
  }

  /** The box's text settings: alignment, wrapping, truncation (textTruncation before maxLines, FX-040), a path's start. */
  #box(
    node: TextLayer,
    props: FigmaProps,
    refused: ReadonlySet<keyof FigmaProps>,
    fail: Fail,
  ): boolean {
    const text = node as TextNode;
    const { textAlignHorizontal, textWrapStyle, truncate, pathStart } = props;
    const writers: Readonly<Record<(typeof TEXT_BOX_KEYS)[number], () => void>> = {
      textAlignHorizontal: () => this.#assign.set(node, { textAlignHorizontal }),
      textWrapStyle: () => this.#assign.set(text, { textWrapStyle }),
      truncate: () =>
        this.#assign.set(text, {
          textTruncation: (truncate ?? false) ? TEXT_FIGMA.ending : TEXT_FIGMA.disabled,
          maxLines: (truncate ?? false) ? TEXT_FIGMA.truncatedLines : null,
        }),
      pathStart: () => this.#assign.set(node as TextPathNode, { textPathStartData: pathStart && { ...pathStart } }),
    };
    let wrote = false;

    for (const key of TEXT_BOX_KEYS) {
      if (props[key] !== undefined && !refused.has(key)) {
        try {
          writers[key]();
          wrote = true;
        } catch (error) {
          fail(error, [key]);
        }
      }
    }

    return wrote;
  }
}

export const TEXT_WRITER = new InjectionToken<TextWriter>("TextWriter");
