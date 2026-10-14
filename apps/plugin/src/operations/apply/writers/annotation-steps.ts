import type { FigmaProps } from "@pixelwright/core";
import { assign } from "../../../figma/assign.ts";
import { isAnnotated } from "../../../figma/capabilities.ts";
import { WriteError } from "../../../figma/write-error.ts";
import { guarded, type Step } from "./step.ts";

type Annotated = Extract<SceneNode, { annotations: ReadonlyArray<Annotation> }>;

/** What the layer says beside how it looks: a component's description, Dev Mode notes, a link. */
export const ANNOTATION_STEPS: readonly Step[] = [
  {
    keys: ["description"],
    write: (node, { description }) => {
      if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
        throw new WriteError("A description belongs to a component or a component set.");
      }

      if (description !== undefined) {
        assign(node, "description", description);
      }
    },
  },
  {
    keys: ["notes"],
    write: guarded(isAnnotated, "Dev Mode notes", notes),
  },
  {
    keys: ["hyperlink"],
    write: (node) => {
      if (node.type !== "TEXT") {
        throw new WriteError(
          "A link on a frame is a prototype reaction: it is written in the next stage.",
          "A Text takes href.",
        );
      }
    },
  },
];

/**
 * Dev Mode annotations, the whole list design_read shows, each category found by its label (made when the file lacks
 * it). A note that comes back as it was keeps its formatting and pinned properties; notes without text, which
 * design_read cannot show, stay.
 */
async function notes(node: Annotated, { notes: given }: FigmaProps): Promise<void> {
  const categories = await categoriesByLabel();
  const before: readonly Annotation[] = Array.isArray(node.annotations) ? node.annotations : [];
  const unused = before.filter((annotation) => textOf(annotation) !== "");
  const annotations: Annotation[] = [];

  for (const { category, label } of given ?? []) {
    const id = category === null ? undefined : await categoryId(categories, category);
    const at = unused.findIndex((annotation) => textOf(annotation) === label);
    const kept = at === -1 ? undefined : unused.splice(at, 1)[0];
    const { categoryId: _category, ...rest } = kept ?? { label };

    annotations.push({
      ...rest,
      ...(id === undefined ? {} : { categoryId: id }),
    });
  }

  node.annotations = [...annotations, ...before.filter((annotation) => textOf(annotation) === "")];
}

const textOf = (annotation: Annotation) => annotation.label ?? annotation.labelMarkdown ?? "";

async function categoriesByLabel(): Promise<Map<string, string>> {
  return new Map(
    (await figma.annotations.getAnnotationCategoriesAsync()).map((category) => [
      category.label.toLowerCase(),
      category.id,
    ]),
  );
}

/** A category's id by its label, made when the file lacks it. */
async function categoryId(categories: Map<string, string>, label: string): Promise<string> {
  const known = categories.get(label.toLowerCase());

  if (known !== undefined) {
    return known;
  }

  const made = (
    await figma.annotations.addAnnotationCategoryAsync({
      label,
      color: "blue",
    })
  ).id;

  categories.set(label.toLowerCase(), made);

  return made;
}
