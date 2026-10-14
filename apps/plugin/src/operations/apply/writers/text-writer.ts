import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import type { TypedLayer } from "../../../figma/capabilities.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { BASE_FIELDS, inherit, longest, restoreLook } from "./text-look.ts";
import { TextRange } from "./text-range.ts";
import { RUN_FIELDS, RUN_WRITERS, type RunKey } from "./text-runs.ts";
import type { WriteScope } from "./write-scope.ts";

type TextFail = (key: keyof FigmaProps | "text", error: unknown) => void;

const BOX_KEYS = ["textAlignHorizontal", "textWrapStyle", "truncate"] as const;

/** What only a text has; a link on another layer is refused by its own step. */
const TEXT_KEYS: readonly (keyof FigmaProps)[] = [
  ...RUN_FIELDS.map(([key]) => key).filter((key) => key !== "hyperlink"),
  ...BOX_KEYS,
];

/** Whether a change writes anything only a text has. */
export function hasTextProps(props: FigmaProps): boolean {
  return TEXT_KEYS.some((key) => props[key] !== undefined);
}

/** A layer that is no text, given a text or text styles: they go on a Text inside it. */
export function holdsNoText(node: TypedLayer): WriteError {
  return new WriteError(`A ${node.type.toLowerCase()} holds no text: text and its styles go on a Text inside it.`);
}

/**
 * A text's characters, its own look, its runs and the box's text settings. New characters keep the look the text had
 * (its longest run's); the text's own properties go to the runs that had its own value, as CSS inherits; the spans
 * then set theirs. Each property in its own try: `fail` gets the property and the error.
 */
export class TextWriter {
  readonly #node: TextNode;
  readonly #change: ApplyChange;
  readonly #scope: WriteScope;

  constructor(node: TextNode, change: ApplyChange, scope: WriteScope) {
    this.#node = node;
    this.#change = change;
    this.#scope = scope;
  }

  /** Whether it wrote anything. */
  async write(fail: TextFail): Promise<boolean> {
    let wrote = false;

    try {
      wrote = await this.#characters();
    } catch (error) {
      fail("text", error);

      return false;
    }

    const own = await this.#ownLook(fail);
    const spans = await this.#spans(fail);
    const box = this.#box(fail);

    return wrote || own || spans || box;
  }

  /**
   * The characters, when they changed. New ones take the first one's look, which for one run is the text's own; a text
   * of several runs takes its own look again over all of it, so a span removed or moved leaves nothing behind.
   */
  async #characters(): Promise<boolean> {
    const text = this.#change.text;

    if (text === undefined) {
      return false;
    }

    const node = this.#node;
    const segments = node.getStyledTextSegments(BASE_FIELDS);
    const base = longest(segments);
    const retyped = node.characters !== text.characters;

    if (retyped) {
      this.#refuseUnloaded();
      setCharacters(node, text.characters);
    }

    if (segments.length > 1 && base !== undefined && node.characters.length > 0) {
      await restoreLook(node, base);
    }

    return retyped || segments.length > 1;
  }

  #refuseUnloaded(): void {
    const unloaded = fontsOf(this.#node).find((font) => this.#scope.isUnloaded(font));

    if (unloaded !== undefined) {
      throw new WriteError(
        `The text uses ${unloaded.family} ${unloaded.style}, which this Figma cannot load: its characters cannot change.`,
        "Install the font, or give the text a font this Figma has first.",
      );
    }
  }

  /** The text's own properties, over the runs that had its own value. */
  async #ownLook(fail: TextFail): Promise<boolean> {
    let wrote = false;

    for (const [key, fields] of RUN_FIELDS) {
      if (this.#change.props[key] !== undefined) {
        try {
          await inherit(this.#node, fields, (start, end) =>
            this.#run(key, this.#change.props, new TextRange(this.#node, start, end)),
          );
          wrote = true;
        } catch (error) {
          fail(key, error);
        }
      }
    }

    return wrote;
  }

  /** What each span sets over its characters. */
  async #spans(fail: TextFail): Promise<boolean> {
    let wrote = false;

    for (const run of this.#change.text?.runs ?? []) {
      for (const [key] of RUN_FIELDS) {
        if (run.props[key] !== undefined && run.end > run.start) {
          try {
            await this.#run(key, run.props, new TextRange(this.#node, run.start, run.end));
            wrote = true;
          } catch (error) {
            fail(key, error);
          }
        }
      }
    }

    return wrote;
  }

  async #run(key: RunKey, props: FigmaProps, range: TextRange): Promise<void> {
    await RUN_WRITERS[key](range, props, this.#scope);
  }

  /** The box's text settings: alignment, wrapping, truncation. */
  #box(fail: TextFail): boolean {
    const props = this.#change.props;
    const node = this.#node;
    const writers: Record<(typeof BOX_KEYS)[number], () => void> = {
      textAlignHorizontal: () => {
        if (props.textAlignHorizontal !== undefined) {
          assign(node, "textAlignHorizontal", props.textAlignHorizontal);
        }
      },
      textWrapStyle: () => {
        if (props.textWrapStyle !== undefined) {
          assign(node, "textWrapStyle", props.textWrapStyle);
        }
      },
      truncate: () => {
        assign(node, "textTruncation", props.truncate ? "ENDING" : "DISABLED");
        assign(node, "maxLines", props.truncate ? 1 : null);
      },
    };
    let wrote = false;

    for (const key of BOX_KEYS) {
      if (props[key] !== undefined) {
        try {
          writers[key]();
          wrote = true;
        } catch (error) {
          fail(key, error);
        }
      }
    }

    return wrote;
  }
}

/** The fonts a text uses: an empty one through its own fontName, since Figma refuses a range of no characters. */
function fontsOf(node: TextNode): FontName[] {
  if (node.characters.length > 0) {
    return node.getRangeAllFontNames(0, node.characters.length);
  }

  return typeof node.fontName === "object" && node.fontName !== null ? [node.fontName] : [];
}

/**
 * Characters through the component property they are bound to, when an instance holds it (written on the text itself
 * they would not stick); otherwise on the text, an override inside an instance.
 */
function setCharacters(node: TextNode, characters: string): void {
  const key = node.componentPropertyReferences?.characters;

  for (let owner = node.parent; key !== undefined && owner !== null; owner = owner.parent) {
    if (owner.type === "INSTANCE" && Object.hasOwn(owner.componentProperties ?? {}, key)) {
      owner.setProperties({ [key]: characters });

      return;
    }
  }

  node.characters = characters;
}
