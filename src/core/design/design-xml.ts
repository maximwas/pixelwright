import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LAYER_TREE } from "@/core/design/tree/layer-tree.ts";
import { XML_WRITER } from "@/core/xml/xml-writer.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** design_read's entry: a read model in, its design XML out, built as a tree first and written last (C-140). */
@injectable()
export class DesignXml {
  readonly #tree;
  readonly #writer;

  constructor(tree = inject(LAYER_TREE), writer = inject(XML_WRITER)) {
    this.#tree = tree;
    this.#writer = writer;
  }

  xml(model: ReadModel): string {
    return this.#writer.xml(this.#tree.root(model));
  }
}

export const DESIGN_XML = new InjectionToken<DesignXml>("DesignXml");
