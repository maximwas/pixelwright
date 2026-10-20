import type { OperationInput, OperationOutput, SnapshotNode } from "@pixelwright/core";
import { colorProfile } from "../../figma/color-profile.ts";
import { annotationCategories } from "../../figma/layer-read/fields/notes.ts";
import type { EntryContext } from "../../figma/layer-read/layer-entry.ts";
import { entryOf } from "../../figma/layer-read/read-layer.ts";
import { References } from "../../figma/layer-read/references.ts";
import { isLayer, pageOf } from "../../figma/nodes.ts";
import { type ModedNode, rootModes } from "../../figma/variable-modes.ts";
import { SnapshotBudget, SubtreeRead } from "./subtree.ts";

type Root = OperationOutput<"entries">["roots"][number];

/**
 * design_apply's view of the layers it changes, as design_read would see them: each layer asked for that is not inside
 * another one asked for, with its descendants and its parent's own entry, from the parent's origin so they place each
 * other as in a read. The size budget is shared, and goes first to the layers asked for and the layers on the way to
 * them, so a big screen named around a deep layer still reads that layer.
 */
export async function entries({ ids }: OperationInput<"entries">): Promise<OperationOutput<"entries">> {
  const found = await Promise.all(
    ids.map(async (id) => ({
      id,
      node: await figma.getNodeByIdAsync(id),
    })),
  );
  const layers = found.flatMap(({ node }) => (node !== null && isLayer(node) ? [node] : []));
  // A page asked for (a <Page id> element) is no layer: the layers on it are roots of their own.
  const asked = new Set(layers.map(({ id }) => id));
  const references = new References();
  const read = new EntriesRead({
    asked,
    first: namedFirst(layers, asked),
    references,
    categories: await annotationCategories(),
  });
  const outermost = layers.filter((node) => !inside(node, asked));

  return {
    roots: await read.roots(outermost),
    ...colorProfile(),
    missing: found.flatMap(({ id, node }) => (node === null || !isLayer(node) ? [id] : [])),
    styles: await references.styles(new Set(outermost.map(pageOf))),
    variables: await references.variables(),
  };
}

/** What every layer of one call's entries shares: the layers asked for, which go first, the references, categories. */
interface EntriesParts {
  readonly asked: ReadonlySet<string>;
  readonly first: (layer: SceneNode) => boolean;
  readonly references: References;
  readonly categories: ReadonlyMap<string, string>;
}

/** The entries of one call: the layers asked for, the references and categories every layer shares, one budget. */
class EntriesRead {
  readonly #parts: EntriesParts;
  readonly #budget = new SnapshotBudget();

  constructor(parts: EntriesParts) {
    this.#parts = parts;
  }

  /** The layers asked for, whole: what each call names and the way to it first, in every root, then the rest. */
  async roots(nodes: readonly SceneNode[]): Promise<Root[]> {
    const started: { node: SceneNode; read: SubtreeRead; context: (layer: SceneNode) => EntryContext }[] = [];

    for (const node of nodes) {
      const context = this.#context(node);

      started.push({
        node,
        context,
        read: await SubtreeRead.start(node, this.#budget, {
          read: (layer) => entryOf(layer, context(layer)),
          open: (layer) => this.#parts.asked.has(layer.id),
          first: this.#parts.first,
        }),
      });
    }

    for (const { read } of started) {
      await read.expand({ firstOnly: true });
    }

    const roots: Root[] = [];

    for (const { node, read, context } of started) {
      await read.expand();
      roots.push(await this.#root(node, read.top, context));
    }

    return roots;
  }

  /** How a root's layers are read: from its parent's origin, the layers asked for whole. */
  #context(node: SceneNode): (layer: SceneNode) => EntryContext {
    const [[, , x], [, , y]] = (parentLayer(node) ?? node).absoluteTransform;

    return (layer) => ({
      x: x ?? 0,
      y: y ?? 0,
      css: "none",
      references: this.#parts.references,
      categories: this.#parts.categories,
      whole: this.#parts.asked.has(layer.id),
    });
  }

  /** A root read, with its parent's own entry (or the page it is on) and the modes it takes from above. */
  async #root(node: SceneNode, entry: SnapshotNode, context: (layer: SceneNode) => EntryContext): Promise<Root> {
    const parent = parentLayer(node);
    const page = parent === null ? pageOf(node) : null;
    // As a read's root: the modes it takes from above count as its own, so a read sent back sets none of them.
    const modes = await rootModes(node as ModedNode, this.#parts.references.lookup);

    if (modes.length > 0) {
      entry.modes = modes;
    }

    return {
      node: entry,
      parent: parent === null ? null : await entryOf(parent, context(parent)),
      ...(page === null ? {} : { page: page.id }),
    };
  }
}

/** A layer's parent when that is a layer; null on a page. */
function parentLayer(node: SceneNode): SceneNode | null {
  return node.parent !== null && isLayer(node.parent) ? node.parent : null;
}

/**
 * The layers read first: those asked for, the layers above them, and the layers inside one asked for that holds no
 * other. An outer layer named only to hold the rest gets its own layers read after them.
 */
function namedFirst(named: readonly SceneNode[], asked: ReadonlySet<string>): (layer: SceneNode) => boolean {
  const above = new Set<string>();

  for (const node of named) {
    for (let at = node.parent; at !== null; at = at.parent) {
      above.add(at.id);
    }
  }

  const innermost = new Set([...asked].filter((id) => !above.has(id)));

  return (layer) => asked.has(layer.id) || above.has(layer.id) || inside(layer, innermost);
}

/** Whether a layer sits inside one of these layers. */
function inside(node: BaseNode, asked: ReadonlySet<string>): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (asked.has(current.id)) {
      return true;
    }
  }

  return false;
}
