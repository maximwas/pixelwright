import type { ApplyChange, FontSpec } from "@pixelwright/core";
import { type FontCatalog, fontKey, type KnownFont, textFonts } from "../../figma/fonts.ts";
import type { TokenIndex } from "../../figma/tokens/token-index.ts";
import { WriteError } from "../../figma/write-error.ts";
import { errorMessage } from "../../utils/error-message.ts";

/** The font a new text starts with: loaded before its characters are set. */
export const NEW_TEXT_FONT: FontName = {
  family: "Inter",
  style: "Regular",
};

interface Preparing {
  readonly dryRun: boolean;
  readonly catalog: FontCatalog;
  readonly tokens: () => Promise<TokenIndex>;
}

const keyOf = (font: FontName) => `${font.family} ${font.style}`;

/**
 * The fonts of a call: each one the changes ask for, found once, and every font of the texts they change, loaded up
 * front (not on a dry run). A font this Figma could not load is remembered: a text using it cannot be retyped.
 */
export class ApplyFonts {
  readonly #found: ReadonlyMap<string, FontName | WriteError>;
  readonly #unloaded: Set<string>;

  constructor(found: ReadonlyMap<string, FontName | WriteError>, unloaded: Set<string>) {
    this.#found = found;
    this.#unloaded = unloaded;
  }

  static async prepare(changes: readonly ApplyChange[], { dryRun, catalog, tokens }: Preparing): Promise<ApplyFonts> {
    const wanted: FontName[] = [];
    const known = await changedTextFonts(changes, wanted);
    const found = await specFonts(changes, {
      catalog,
      tokens,
      known,
      wanted,
    });

    return new ApplyFonts(found, dryRun ? new Set() : await loaded(wanted));
  }

  /** The font a spec found, or why it could not be found. */
  font(spec: FontSpec): FontName | WriteError | undefined {
    return this.#found.get(fontKey(spec));
  }

  isUnloaded(font: FontName): boolean {
    return this.#unloaded.has(keyOf(font));
  }

  /** A text that exists only now, in a copy or a new instance: its fonts (its component's) load before it is written. */
  async loadFor(text: TextNode): Promise<void> {
    for (const font of textFonts(text)) {
      await figma.loadFontAsync(font).catch(() => this.#unloaded.add(keyOf(font)));
    }
  }
}

/**
 * A text being changed has its fonts loaded whatever changes (sizing it needs them too), and the fonts it uses are the
 * first choice for the weights design_read wrote: a copy's are its source's. A new text starts in Inter.
 */
async function changedTextFonts(changes: readonly ApplyChange[], wanted: FontName[]): Promise<KnownFont[]> {
  const known: KnownFont[] = [];

  for (const change of changes) {
    const id = change.kind === "update" ? (change.id ?? change.source ?? null) : (change.copyOf ?? null);
    const node = id === null ? null : await figma.getNodeByIdAsync(id);

    if (node?.type === "TEXT") {
      wanted.push(...textFonts(node));
      known.push(...knownFonts(node));
    } else if (change.kind === "create" && change.copyOf === undefined && change.tag === "Text") {
      wanted.push(NEW_TEXT_FONT);
    }
  }

  return known;
}

/** Each font the changes and their runs ask for, found once; a text style's font is wanted too. */
async function specFonts(
  changes: readonly ApplyChange[],
  { catalog, tokens, known, wanted }: Omit<Preparing, "dryRun"> & { known: readonly KnownFont[]; wanted: FontName[] },
): Promise<Map<string, FontName | WriteError>> {
  const found = new Map<string, FontName | WriteError>();

  for (const props of changes.flatMap((change) => [
    change.props,
    ...(change.text?.runs ?? []).map((run) => run.props),
  ])) {
    if (props.font !== undefined && !found.has(fontKey(props.font))) {
      const font = await catalog
        .fontNameOf(props.font, known)
        .catch((error: unknown) => (error instanceof WriteError ? error : new WriteError(errorMessage(error))));

      found.set(fontKey(props.font), font);

      if (!(font instanceof WriteError)) {
        wanted.push(font);
      }
    }

    if (props.textStyle !== undefined && props.textStyle !== "") {
      wanted.push(...(await styleFonts(await tokens(), props.textStyle)));
    }
  }

  return found;
}

/** Loads each wanted font once; the ones this Figma could not load, by family and style. */
async function loaded(wanted: readonly FontName[]): Promise<Set<string>> {
  const unloaded = new Set<string>();
  const unique = new Map(wanted.map((font) => [keyOf(font), font]));

  await Promise.all([...unique].map(([key, font]) => figma.loadFontAsync(font).catch(() => unloaded.add(key))));

  return unloaded;
}

async function styleFonts(index: TokenIndex, name: string): Promise<FontName[]> {
  try {
    const style = await figma.getStyleByIdAsync(await index.textStyle(name));

    return style?.type === "TEXT" ? [(style as TextStyle).fontName] : [];
  } catch {
    // An unknown style is the textStyle step's error.
    return [];
  }
}

function knownFonts(node: TextNode): KnownFont[] {
  if (node.characters.length === 0) {
    return node.fontName === figma.mixed || node.fontWeight === figma.mixed
      ? []
      : [
          {
            fontName: node.fontName,
            weight: node.fontWeight,
          },
        ];
  }

  return node.getStyledTextSegments(["fontName", "fontWeight"]).map((segment) => ({
    fontName: segment.fontName,
    weight: segment.fontWeight,
  }));
}
