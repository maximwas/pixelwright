import { inject, injectable } from "@needle-di/core";
import { CAPABILITY } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { NOTE_VALUE, STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Annotated = SceneNode & { annotations: readonly Annotation[] };

type Note = NonNullable<FigmaProps["notes"]>[number];

/** A new note's text and the category it is filed under, when the file has one its text starts with. */
interface Filed {
  readonly categoryId?: string;
  readonly label: string;
}

/**
 * Dev Mode annotations, the whole list design_read shows (T-139, B-017). A note the layer has, sent back as design_read
 * writes it, stays as it was (category, formatting, pinned properties); `Category: text` files a new note under the
 * file's category of that name, and a name the file has no category for stays text: no category is ever made. Notes
 * without text, which design_read cannot show, stay.
 */
@injectable()
export class NoteStep implements WriteStep {
  readonly keys = STEP_KEYS.notes;
  readonly capability = CAPABILITY.annotations;
  readonly #factory;

  constructor(factory = inject(LAYER_FACTORY)) {
    this.#factory = factory;
  }

  async write(node: SceneNode, { notes }: FigmaProps): Promise<void> {
    const layer = node as Annotated;
    const categories = await this.#factory.categories();
    const before = [...layer.annotations];
    const unused = before.filter((annotation) => this.#text(annotation) !== "");
    const texts = this.#texts(
      (notes ?? []).map((note) => this.#given(note)),
      unused,
      categories,
    );
    const annotations = texts.map((text) => this.#annotation(text, unused, categories));
    const untold = before.filter((annotation) => this.#text(annotation) === "").map((each) => this.#writable(each));

    layer.annotations = [...annotations, ...untold];
  }

  #given({ category, label }: Note): string {
    return category === null ? label : WRITERS_TEXT.note(category, label);
  }

  /**
   * The notes core's parts make (design_read's note split at every unescaped bar): a bar separates only where the
   * format means it, next to a note the layer has or before a note a category starts; between new words it is the
   * agent's text, so `Tabs: Days | Weeks` stays one note.
   */
  #texts(
    parts: readonly string[],
    unused: readonly Annotation[],
    categories: readonly AnnotationCategory[],
  ): string[] {
    const had = (text: string) => unused.some((annotation) => this.#read(annotation, categories) === text);
    const starts = (text: string) => this.#filed(text, categories).categoryId !== undefined;
    const texts: string[] = [];
    let open = false;

    for (const part of parts) {
      const last = texts.length - 1;

      if (open && !had(part) && !starts(part)) {
        texts[last] = WRITERS_TEXT.barred(texts[last] ?? "", part);
      } else {
        texts.push(part);
        open = !had(part);
      }
    }

    return texts;
  }

  /** The note for a text: the layer's own when it reads the same; else new, keeping the formatting of the same words. */
  #annotation(
    text: string,
    unused: Annotation[],
    categories: readonly AnnotationCategory[],
  ): Annotation {
    const same = unused.findIndex((annotation) => this.#read(annotation, categories) === text);

    if (same !== -1) {
      return this.#writable(unused.splice(same, 1)[0] as Annotation);
    }

    const { categoryId, label } = this.#filed(text, categories);
    // The same words under another category keep their formatting and pins.
    const at = unused.findIndex((annotation) => this.#text(annotation) === label);
    const kept = at === -1 ? { label } : this.#uncategorised(this.#writable(unused.splice(at, 1)[0] as Annotation));

    return categoryId === undefined ? kept : { ...kept, categoryId };
  }

  #uncategorised({ categoryId: _old, ...rest }: Annotation): Annotation {
    return rest;
  }

  #text(annotation: Annotation): string {
    return annotation.label ?? annotation.labelMarkdown ?? "";
  }

  /** A note as design_read writes it: `Category: text`, or the text alone. */
  #read(annotation: Annotation, categories: readonly AnnotationCategory[]): string {
    const category = categories.find(({ id }) => id === annotation.categoryId);

    return category === undefined ? this.#text(annotation) : WRITERS_TEXT.note(category.label, this.#text(annotation));
  }

  /** A new note's category: the file's category its text starts with (`Category: text`), if the file has one. */
  #filed(text: string, categories: readonly AnnotationCategory[]): Filed {
    const at = text.indexOf(NOTE_VALUE.category);
    const name = text.slice(0, at).toLowerCase();
    const category = at === -1 ? undefined : categories.find(({ label }) => label.toLowerCase() === name);

    return category === undefined
      ? { label: text }
      : { categoryId: category.id, label: text.slice(at + NOTE_VALUE.category.length) };
  }

  /** FX-045: Figma reads both texts but refuses a write that gives both; the Markdown is kept. */
  #writable({ label, labelMarkdown, ...rest }: Annotation): Annotation {
    if (labelMarkdown !== undefined && labelMarkdown !== "") {
      return { ...rest, labelMarkdown };
    }

    return label === undefined || label === "" ? rest : { ...rest, label };
  }
}
