import type { FigmaProps } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { isAnnotated, type TypedLayer } from "../../../figma/capabilities.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { guarded, type Step } from "./step.ts";

type Annotated = Extract<SceneNode, { annotations: ReadonlyArray<Annotation> }>;

/** What the layer says beside how it looks: a component's description, Dev Mode notes, a link. */
export const ANNOTATION_STEPS: readonly Step[] = [
  {
    keys: ["description"],
    write: (node, { description }) => {
      describable(node);

      if (description !== undefined && (node.type === "COMPONENT" || node.type === "COMPONENT_SET")) {
        assign(node, "description", description);
      }
    },
    check: describable,
  },
  {
    keys: ["notes"],
    ...guarded(isAnnotated, "Dev Mode notes", notes),
  },
  {
    keys: ["hyperlink"],
    write: linkable,
    check: linkable,
  },
];

function describable(node: TypedLayer): void {
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
    throw new WriteError("A description belongs to a component or a component set.");
  }
}

/** A text's link is a run of it, written by the text writer; another layer's would be a prototype reaction. */
function linkable(node: TypedLayer): void {
  if (node.type !== "TEXT") {
    throw new WriteError(
      "A link on a frame is a prototype reaction: it is written in the next stage.",
      "A Text takes href.",
    );
  }
}

/**
 * Dev Mode annotations, the whole list design_read shows. A note the layer has, sent back as design_read writes it,
 * stays as it was (category, formatting, pinned properties); `Category: text` files a new note under the file's
 * category of that name, and a name the file has no category for stays text: no category is ever made. Notes without
 * text, which design_read cannot show, stay.
 */
async function notes(node: Annotated, { notes: given }: FigmaProps): Promise<void> {
  const categories = await figma.annotations.getAnnotationCategoriesAsync();
  const before: readonly Annotation[] = Array.isArray(node.annotations) ? node.annotations : [];
  const unused = before.filter((annotation) => textOf(annotation) !== "");
  const read = (annotation: Annotation) => readText(annotation, categories);
  const texts = noteTexts(
    (given ?? []).map(({ category, label }) => (category === null ? label : `${category}: ${label}`)),
    (text) => unused.some((annotation) => read(annotation) === text),
    (text) => filed(text, categories).categoryId !== undefined,
  );
  const annotations = texts.map((text) => {
    const same = unused.findIndex((annotation) => read(annotation) === text);

    if (same !== -1) {
      return writable(unused.splice(same, 1)[0] as Annotation);
    }

    const { categoryId, label } = filed(text, categories);
    // The same words under another category keep their formatting and pins.
    const at = unused.findIndex((annotation) => textOf(annotation) === label);
    const { categoryId: _old, ...kept } = at === -1 ? { label } : writable(unused.splice(at, 1)[0] as Annotation);

    return categoryId === undefined
      ? kept
      : {
          ...kept,
          categoryId,
        };
  });

  node.annotations = [...annotations, ...before.filter((annotation) => textOf(annotation) === "").map(writable)];
}

/**
 * The notes core's parts make (design_read's note split at every unescaped bar). A bar separates only where the format
 * means it: next to a note the layer has, or before a note a category starts; between new words it is the agent's
 * text, so `Tabs: Days | Weeks` stays one note.
 */
function noteTexts(parts: readonly string[], had: (text: string) => boolean, starts: (text: string) => boolean) {
  const texts: string[] = [];
  let open = false;

  for (const part of parts) {
    if (open && !had(part) && !starts(part)) {
      texts[texts.length - 1] += ` | ${part}`;
    } else {
      texts.push(part);
      open = !had(part);
    }
  }

  return texts;
}

const textOf = (annotation: Annotation) => annotation.label ?? annotation.labelMarkdown ?? "";

/** A note as design_read writes it: `Category: text`, or the text alone. */
function readText(annotation: Annotation, categories: readonly AnnotationCategory[]): string {
  const category = categories.find(({ id }) => id === annotation.categoryId);

  return category === undefined ? textOf(annotation) : `${category.label}: ${textOf(annotation)}`;
}

/** A new note's category: the file's category its text starts with (`Category: text`), if the file has one. */
function filed(text: string, categories: readonly AnnotationCategory[]): { categoryId?: string; label: string } {
  const at = text.indexOf(": ");
  const name = text.slice(0, at).toLowerCase();
  const category = at === -1 ? undefined : categories.find(({ label }) => label.toLowerCase() === name);

  return category === undefined
    ? { label: text }
    : {
        categoryId: category.id,
        label: text.slice(at + 2),
      };
}

/** An annotation as Figma takes it back: it reads both texts but refuses a write that gives both (Markdown kept). */
function writable({ label, labelMarkdown, ...rest }: Annotation): Annotation {
  if (labelMarkdown !== undefined && labelMarkdown !== "") {
    return {
      ...rest,
      labelMarkdown,
    };
  }

  return label === undefined || label === ""
    ? rest
    : {
        ...rest,
        label,
      };
}
