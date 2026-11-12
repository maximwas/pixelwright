import { motionOf } from "../../../figma/motion.ts";
import type { LayerEntry } from "../layer-entry.ts";

/** What instances override on the layer, the designer's annotations on it, and its Figma Motion. */
export function readNotes(entry: LayerEntry): void {
  const { node, context } = entry;

  context.overrides?.record(node);

  const overridden = context.overrides?.on(node) ?? [];

  if (overridden.length > 0) {
    entry.set("overrides", overridden);
  }

  const notes = annotationsOf(node, context.categories);

  if (notes.length > 0) {
    entry.set("annotations", notes);
  }

  entry.put("motion", motionOf(node));
}

/** The file's annotation category names by id. */
export async function annotationCategories(): Promise<ReadonlyMap<string, string>> {
  // Older Figma versions and the tests' fake have no annotations API.
  const categories = await figma.annotations?.getAnnotationCategoriesAsync().catch(() => []);

  return new Map((categories ?? []).map((category) => [category.id, category.label]));
}

/** A note a layer's annotation leaves: its text, its category, the properties it pins. */
interface Note {
  label?: string;
  category?: string;
  pins?: string[];
}

/** The layer's annotations that say something. */
function annotationsOf(node: SceneNode, categories: ReadonlyMap<string, string>): Note[] {
  if (!("annotations" in node)) {
    return [];
  }

  return node.annotations.flatMap((annotation) => noteOf(annotation, categories) ?? []);
}

/** What an annotation says: a note, pinned properties, or both; null for one that says nothing. */
function noteOf(annotation: Annotation, categories: ReadonlyMap<string, string>): Note | null {
  const label = annotation.label ?? annotation.labelMarkdown;
  const category = annotation.categoryId === undefined ? undefined : categories.get(annotation.categoryId);
  const pins = (annotation.properties ?? []).map((property) => property.type);
  const noted = label !== undefined && label !== "";

  if (!noted && pins.length === 0) {
    return null;
  }

  return {
    ...(noted ? { label } : {}),
    ...(category === undefined ? {} : { category }),
    ...(pins.length === 0 ? {} : { pins }),
  };
}
