import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import type { RenderedDesign, XmlRead } from "@/core/design/design.types.ts";
import { REPEAT_FOLD } from "@/core/design/repeats/repeat-fold.ts";
import { LAYER_TREE, type TreeOptions } from "@/core/design/tree/layer-tree.ts";
import type { XmlElement } from "@/core/xml/xml.types.ts";
import { XML_WRITER } from "@/core/xml/xml-writer.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** What a read shows: a fit's cuts and the asset plan, and whether runs of alike neighbours fold (T-059). */
export interface DesignOptions extends TreeOptions {
  readonly repeats?: boolean;
}

/**
 * design_read's XML: a read model in, built as a tree first and written last (C-140); runs of alike neighbours read
 * as their first when asked, so a fit measures the read as it is written.
 */
@injectable()
export class DesignXml {
  readonly #tree;
  readonly #writer;
  readonly #fold;

  constructor(
    tree = inject(LAYER_TREE),
    writer = inject(XML_WRITER),
    fold = inject(REPEAT_FOLD),
  ) {
    this.#tree = tree;
    this.#writer = writer;
    this.#fold = fold;
  }

  xml(model: ReadModel): string {
    return this.read(model).xml;
  }

  read(model: ReadModel, options: DesignOptions = {}): XmlRead {
    return this.render(model, options).read;
  }

  /** The read with its lines and each layer's span in them. */
  render(model: ReadModel, options: DesignOptions = {}): RenderedDesign {
    const built = this.#tree.root(model, options);
    const truncated = this.#truncated(built);
    const { root, repeats } = (options.repeats ?? false) ? this.#fold.fold(built) : { root: built, repeats: null };
    const { xml, lines, spans } = this.#writer.written(root);

    return { read: { xml, truncated, ...(repeats === null ? {} : { repeats }) }, tree: built, lines, spans };
  }

  /** The layers shown cut, in document order: `$children` or `$truncated` on them, folded runs included. */
  #truncated(element: XmlElement | null): string[] {
    if (element === null) {
      return [];
    }

    const cut = element.attributes.some(
      ([name]) => name === DESIGN_ATTRIBUTE.children || name === DESIGN_ATTRIBUTE.truncated,
    );

    return [...(cut ? [element.id] : []), ...element.children.flatMap((child) => this.#truncated(child))];
  }
}

export const DESIGN_XML = new InjectionToken<DesignXml>("DesignXml");
