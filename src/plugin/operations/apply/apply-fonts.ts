import { InjectionToken, inject, injectable } from "@needle-di/core";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { FONT_CATALOG, type FontSpec, type KnownFont } from "@/plugin/adapters/figma/fonts/font-catalog.ts";
import { FONT_FIELDS, FONT_TEXT, NEW_TEXT_FONT } from "@/plugin/adapters/figma/fonts/fonts.constants.ts";
import { LAYER_FACTORY, type TextLayer } from "@/plugin/adapters/figma/layer-factory.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TEXT_TAG, TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { TOKEN_INDEX } from "@/plugin/operations/apply/token-index.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/**
 * One call's fonts (P-148): each font the changes and their Spans ask for, found once (a dry run too, so both refuse
 * an unknown family alike), and on a real call every font of the texts they change, loaded up front, Inter Regular for
 * a new one (FX-040). A font this Figma could not load is remembered: a text using it cannot be retyped.
 */
@injectable()
export class ApplyFonts {
  readonly #catalog;
  readonly #factory;
  readonly #lookup;
  readonly #tokens;
  readonly #found = new Map<string, FontName | WriteError>();
  readonly #unloaded = new Set<string>();

  constructor(
    catalog = inject(FONT_CATALOG),
    factory = inject(LAYER_FACTORY),
    lookup = inject(NODE_LOOKUP),
    tokens = inject(TOKEN_INDEX),
  ) {
    this.#catalog = catalog;
    this.#factory = factory;
    this.#lookup = lookup;
    this.#tokens = tokens;
  }

  async start(changes: readonly ApplyChangeData[], dry: boolean): Promise<void> {
    this.#found.clear();
    this.#unloaded.clear();
    this.#catalog.start();

    const wanted: FontName[] = [];
    const known = await this.#changedTexts(changes, wanted);

    for (const props of changes.flatMap((change) => [
      change.props,
      ...(change.text?.runs ?? []).map((run) => run.props),
    ])) {
      await this.#find(props, known, wanted);
    }

    if (!dry) {
      await this.#load(wanted);
    }
  }

  /** The font a spec found, or why none was. */
  font(spec: FontSpec): FontName | WriteError | undefined {
    return this.#found.get(FONT_TEXT.specKey(spec.family, spec.weight, spec.italic));
  }

  /** A font of the text this Figma could not load. */
  unloadedIn(node: TextLayer): FontName | undefined {
    return this.#factory.textFonts(node).find((font) => this.#unloaded.has(FONT_TEXT.key(font.family, font.style)));
  }

  isUnloaded(font: FontName): boolean {
    return this.#unloaded.has(FONT_TEXT.key(font.family, font.style));
  }

  /**
   * A changed text's fonts load whatever changes (sizing it needs them too) and are the first choice for the weights
   * design_read wrote: a copy's are its source's. A new text starts in Inter Regular.
   */
  async #changedTexts(changes: readonly ApplyChangeData[], wanted: FontName[]): Promise<KnownFont[]> {
    const known: KnownFont[] = [];

    for (const change of changes) {
      const update = change.kind === APPLY_CHANGE_KIND.update;
      const id = update ? (change.id ?? change.source ?? null) : (change.copyOf ?? null);
      const node = id === null ? null : await this.#lookup.node(id);

      if (node !== null && (node.type === FIGMA_NODE_TYPE.text || node.type === FIGMA_NODE_TYPE.textPath)) {
        wanted.push(...this.#factory.textFonts(node));
        known.push(...this.#known(node));
      } else if (!update && change.copyOf === undefined && Object.values<string>(TEXT_TAG).includes(change.tag)) {
        wanted.push(NEW_TEXT_FONT);
      }
    }

    return known;
  }

  async #find(
    props: FigmaProps,
    known: readonly KnownFont[],
    wanted: FontName[],
  ): Promise<void> {
    const { font: spec, textStyle } = props;
    const key = spec === undefined ? null : FONT_TEXT.specKey(spec.family, spec.weight, spec.italic);

    if (spec !== undefined && key !== null && !this.#found.has(key)) {
      const font = await this.#catalog
        .fontName(spec, known)
        .catch((error: unknown) => (error instanceof WriteError ? error : new WriteError(String(error))));

      this.#found.set(key, font);

      if (!(font instanceof WriteError)) {
        wanted.push(font);
      }
    }

    if (textStyle !== undefined && textStyle !== "") {
      wanted.push(...(await this.#styleFonts(textStyle)));
    }
  }

  /** A text style's font: Figma sets a style on a text only once its font is loaded. */
  async #styleFonts(name: string): Promise<FontName[]> {
    const id = await this.#tokens.style(name, TOKEN_KIND.text).catch(() => null);
    const style = id === null ? null : await this.#lookup.style(id);

    // An unknown style is the text's own refusal, not the fonts'.
    return style?.type === TOKEN_KIND.text ? [(style as TextStyle).fontName] : [];
  }

  async #load(wanted: readonly FontName[]): Promise<void> {
    const unique = new Map(wanted.map((font) => [FONT_TEXT.key(font.family, font.style), font]));

    await Promise.all(
      [...unique].map(async ([key, font]) => await this.#factory.loadFont(font).catch(() => this.#unloaded.add(key))),
    );
  }

  #known(node: TextLayer): KnownFont[] {
    if (node.characters.length > 0) {
      return node
        .getStyledTextSegments([...FONT_FIELDS])
        .map(({ fontName, fontWeight }) => ({ fontName, weight: fontWeight }));
    }

    return typeof node.fontName === "object" && typeof node.fontWeight === "number"
      ? [{ fontName: node.fontName, weight: node.fontWeight }]
      : [];
  }
}

export const APPLY_FONTS = new InjectionToken<ApplyFonts>("ApplyFonts");
