import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { colorProfile } from "../../figma/color-profile.ts";
import { annotationCategories } from "../../figma/layer-read/fields/notes.ts";
import type { EntryContext } from "../../figma/layer-read/layer-entry.ts";
import { entryOf } from "../../figma/layer-read/read-layer.ts";
import { References } from "../../figma/layer-read/references.ts";
import { isLayer, pageOf } from "../../figma/nodes.ts";
import { readSubtree, SnapshotBudget } from "./subtree.ts";

type Root = OperationOutput<"entries">["roots"][number];

/**
 * design_apply's view of the layers it changes, as design_read would see them: each layer asked for that is not inside
 * another one asked for, with its descendants and its parent's own entry, from the parent's origin so they place each
 * other as in a read. The size budget is shared.
 */
export async function entries({ ids }: OperationInput<"entries">): Promise<OperationOutput<"entries">> {
  const asked = new Set(ids);
  const references = new References();
  const read = new EntriesRead(asked, references, await annotationCategories());
  const roots: Root[] = [];
  const pages = new Set<PageNode | null>();
  const missing: string[] = [];

  for (const id of ids) {
    const node = await figma.getNodeByIdAsync(id);

    if (node === null || !isLayer(node)) {
      missing.push(id);
    } else if (!inside(node, asked)) {
      pages.add(pageOf(node));
      roots.push(await read.root(node));
    }
  }

  return {
    roots,
    ...colorProfile(),
    missing,
    styles: await references.styles(pages),
    variables: await references.variables(),
  };
}

/** The entries of one call: the layers asked for, the references and categories every layer shares, one budget. */
class EntriesRead {
  readonly #asked: ReadonlySet<string>;
  readonly #references: References;
  readonly #categories: ReadonlyMap<string, string>;
  readonly #budget = new SnapshotBudget();

  constructor(asked: ReadonlySet<string>, references: References, categories: ReadonlyMap<string, string>) {
    this.#asked = asked;
    this.#references = references;
    this.#categories = categories;
  }

  /** A layer asked for, whole, with its parent's own entry, both from the parent's origin. */
  async root(node: SceneNode): Promise<Root> {
    const parent = node.parent !== null && isLayer(node.parent) ? node.parent : null;
    const [[, , x], [, , y]] = (parent ?? node).absoluteTransform;
    const context = (layer: SceneNode): EntryContext => ({
      x: x ?? 0,
      y: y ?? 0,
      css: "none",
      references: this.#references,
      categories: this.#categories,
      whole: this.#asked.has(layer.id),
    });

    return {
      node: await readSubtree(node, this.#budget, {
        read: (layer) => entryOf(layer, context(layer)),
        open: (layer) => this.#asked.has(layer.id),
      }),
      parent: parent === null ? null : await entryOf(parent, context(parent)),
    };
  }
}

/** Whether a layer sits inside one of the layers asked for. */
function inside(node: BaseNode, asked: ReadonlySet<string>): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (asked.has(current.id)) {
      return true;
    }
  }

  return false;
}
