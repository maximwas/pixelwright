import { injectable } from "@needle-di/core";
import type { FieldReader } from "@/plugin/adapters/figma/layer-read/layer-reader.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

type Note = NonNullable<ReadLayer["annotations"]>[number];

/**
 * The designer's Dev Mode annotations that say something: a note (label, or its Markdown when there is no label,
 * FX-045), its category's name, the properties it pins. The categories are asked for only when a note has one.
 */
@injectable()
export class NoteFieldReader implements FieldReader {
  #categoriesAsked: Promise<ReadonlyMap<string, string>> | null = null;

  start(): void {
    this.#categoriesAsked = null;
  }

  async read(node: SceneNode): Promise<Partial<ReadLayer>> {
    if (!("annotations" in node) || node.annotations.length === 0) {
      return {};
    }

    const categories = node.annotations.some(({ categoryId }) => categoryId !== undefined)
      ? await this.#categories()
      : new Map<string, string>();
    const notes = node.annotations.flatMap((annotation) => this.#note(annotation, categories));

    return notes.length === 0 ? {} : { annotations: notes };
  }

  /** The file's annotation category names by id, asked once per read; none when Figma cannot give them. */
  #categories(): Promise<ReadonlyMap<string, string>> {
    this.#categoriesAsked ??= figma.annotations
      .getAnnotationCategoriesAsync()
      .catch(() => [])
      .then((categories) => new Map(categories.map(({ id, label }) => [id, label])));

    return this.#categoriesAsked;
  }

  #note(annotation: Annotation, categories: ReadonlyMap<string, string>): Note[] {
    const label = annotation.label ?? annotation.labelMarkdown;
    const category = annotation.categoryId === undefined ? undefined : categories.get(annotation.categoryId);
    const pins = (annotation.properties ?? []).map(({ type }) => type);
    const noted = label !== undefined && label !== "";

    if (!noted && pins.length === 0) {
      return [];
    }

    return [
      {
        ...(noted ? { label } : {}),
        ...(category === undefined ? {} : { category }),
        ...(pins.length === 0 ? {} : { pins }),
      },
    ];
  }
}
