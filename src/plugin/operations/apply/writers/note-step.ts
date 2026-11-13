import { inject, injectable } from "@needle-di/core";
import { PinWords } from "@/core/css/groups/element/pin-words.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_FACTORY } from "@/plugin/adapters/figma/layer-factory.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Annotated = SceneNode & { annotations: readonly Annotation[] };

type Note = NonNullable<FigmaProps["notes"]>[number];

/** One call's view of the layer: whether it is a text (its fills pin as `color`) and the file's categories. */
interface Scope {
  readonly text: boolean;
  readonly categories: readonly AnnotationCategory[];
}

/**
 * Dev Mode annotations, the whole list design_read shows (T-139, B-017, NEW-090): each note's text, category and the
 * properties it pins. A note the layer has, sent back as design_read writes it, stays as it was (formatting included);
 * `Category: text` files a new note under the file's category of that name, and a name the file has no category for
 * stays text: no category is ever made. A new note pins what its bracket names; one of pins alone is a bracket.
 */
@injectable()
export class NoteStep implements WriteStep {
  readonly keys = STEP_KEYS.notes;
  readonly capability = CAPABILITY.annotations;
  readonly #factory;
  readonly #pins = new PinWords();

  constructor(factory = inject(LAYER_FACTORY)) {
    this.#factory = factory;
  }

  async write(node: SceneNode, { notes }: FigmaProps): Promise<void> {
    const layer = node as Annotated;
    const text = layer.type === FIGMA_NODE_TYPE.text || layer.type === FIGMA_NODE_TYPE.textPath;
    const scope: Scope = { text, categories: await this.#factory.categories() };
    const before = [...layer.annotations];
    const unused = before.filter((annotation) => this.#told(annotation));
    const given = this.#joined(notes ?? [], unused, scope);
    const annotations = given.map((note) => this.#annotation(note, unused, scope));
    const untold = before.filter((annotation) => !this.#told(annotation)).map((each) => this.#writable(each));

    layer.annotations = [...annotations, ...untold];
  }

  /**
   * The notes core's parts make (design_read's note split at every unescaped bar): a bar separates only where the
   * format means it, next to a note the layer has, before a note a category starts or after one that pins; between new
   * words it is the agent's text, so `Tabs: Days | Weeks` stays one note.
   */
  #joined(
    parts: readonly Note[],
    unused: readonly Annotation[],
    scope: Scope,
  ): Note[] {
    const had = (note: Note) => unused.some((annotation) => this.#key(annotation, scope) === this.#given(note));
    const notes: Note[] = [];
    let open = false;

    for (const part of parts) {
      const last = notes.at(-1);

      if (open && last !== undefined && (last.pins ?? []).length === 0 && !had(part) && !this.#starts(part, scope)) {
        notes[notes.length - 1] = {
          ...part,
          category: last.category,
          label: WRITERS_TEXT.barred(last.label, this.#said(part)),
        };
      } else {
        notes.push(part);
        open = !had(part);
      }
    }

    return notes;
  }

  /** The note for a given one: the layer's own when it reads the same; else new, keeping the formatting of the same words. */
  #annotation(
    note: Note,
    unused: Annotation[],
    scope: Scope,
  ): Annotation {
    const same = unused.findIndex((annotation) => this.#key(annotation, scope) === this.#given(note));

    if (same !== -1) {
      return this.#writable(unused.splice(same, 1)[0] as Annotation);
    }

    const categoryId = this.#category(note, scope)?.id;
    const label = categoryId === undefined ? this.#said(note) : note.label;
    // The same words under another category or with other pins keep their formatting.
    const at = label === "" ? -1 : unused.findIndex((annotation) => this.#text(annotation) === label);
    const kept =
      at === -1 ? (label === "" ? {} : { label }) : this.#bare(this.#writable(unused.splice(at, 1)[0] as Annotation));
    const types = this.#pins.types(note.pins ?? [], scope.text);

    return {
      ...kept,
      ...(categoryId === undefined ? {} : { categoryId }),
      ...(types.length === 0 ? {} : { properties: types.map((type) => ({ type: type as AnnotationPropertyType })) }),
    };
  }

  #bare({ categoryId: _category, properties: _pins, ...rest }: Annotation): Annotation {
    return rest;
  }

  /** Whether design_read shows it: it has text or pins. */
  #told(annotation: Annotation): boolean {
    return this.#text(annotation) !== "" || (annotation.properties ?? []).length > 0;
  }

  #text(annotation: Annotation): string {
    return annotation.label ?? annotation.labelMarkdown ?? "";
  }

  /** A note as design_read writes it, `Category: text` then its pins, to compare with a given one. */
  #key(annotation: Annotation, { text, categories }: Scope): string {
    const category = categories.find(({ id }) => id === annotation.categoryId);
    const said =
      category === undefined ? this.#text(annotation) : WRITERS_TEXT.note(category.label, this.#text(annotation));
    const types = (annotation.properties ?? []).map(({ type }) => type);

    return JSON.stringify([said, this.#pins.said(types, text)]);
  }

  #given(note: Note): string {
    return JSON.stringify([this.#said(note), this.#pins.listed(note.pins ?? [])]);
  }

  /** A given note's text as written: `Category: text`, or the text alone. */
  #said({ category, label }: Note): string {
    return category === null ? label : WRITERS_TEXT.note(category, label);
  }

  /** The file's category a note names, in any case; none when the file has no category of that name. */
  #category({ category }: Note, { categories }: Scope): AnnotationCategory | undefined {
    const name = category?.toLowerCase();

    return name === undefined ? undefined : categories.find(({ label }) => label.toLowerCase() === name);
  }

  #starts(note: Note, scope: Scope): boolean {
    return this.#category(note, scope) !== undefined;
  }

  /** FX-045: Figma reads both texts but refuses a write that gives both; the Markdown is kept. */
  #writable({ label, labelMarkdown, ...rest }: Annotation): Annotation {
    if (labelMarkdown !== undefined && labelMarkdown !== "") {
      return { ...rest, labelMarkdown };
    }

    return label === undefined || label === "" ? rest : { ...rest, label };
  }
}
