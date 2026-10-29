import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { NODE_TAG } from "@/core/xml/node-tag.ts";
import { OUTLINE_ATTRIBUTE } from "@/core/xml/outline/outline.constants.ts";
import type { XmlAttribute, XmlElement } from "@/core/xml/xml.types.ts";
import { XML_WRITER } from "@/core/xml/xml-writer.ts";
import type { OutlineNode } from "@/shared/ops/outline/outline.schema.ts";

/** One attribute: its name and its value, none when the layer has none. */
type Attribute = readonly [name: string, value: string | number | boolean | undefined];

/**
 * The outline as light XML (T-044, C-009): one tag per line, metadata and the box only, the box in whole px (D-15). A
 * layer whose children are not all listed carries `$children` with how many it has, so the model outlines it on its own.
 */
@injectable()
export class OutlineXml {
  readonly #numbers;
  readonly #tags;
  readonly #writer;

  constructor(
    numbers = inject(NUMBER_FORMAT),
    tags = inject(NODE_TAG),
    writer = inject(XML_WRITER),
  ) {
    this.#numbers = numbers;
    this.#tags = tags;
    this.#writer = writer;
  }

  xml(root: OutlineNode): string {
    return this.#writer.xml(this.#element(root));
  }

  /** How many layers the outline lists. */
  count(root: OutlineNode): number {
    return (root.children ?? []).reduce((sum, child) => sum + this.count(child), 1);
  }

  #element(node: OutlineNode): XmlElement {
    return {
      id: node.id,
      tag: this.#tags.of(node.type),
      attributes: this.#attributes(node),
      content: null,
      children: (node.children ?? []).map((child) => this.#element(child)),
    };
  }

  #attributes(node: OutlineNode): XmlAttribute[] {
    const listed = node.children?.length ?? 0;
    const unlisted = node.childCount !== undefined && listed < node.childCount;
    const attributes: Attribute[] = [
      [OUTLINE_ATTRIBUTE.id, node.id],
      [OUTLINE_ATTRIBUTE.name, node.name],
      [OUTLINE_ATTRIBUTE.component, node.component],
      [OUTLINE_ATTRIBUTE.variant, node.variant],
      [OUTLINE_ATTRIBUTE.x, this.#box(node.x)],
      [OUTLINE_ATTRIBUTE.y, this.#box(node.y)],
      [OUTLINE_ATTRIBUTE.width, this.#box(node.width)],
      [OUTLINE_ATTRIBUTE.height, this.#box(node.height)],
      [OUTLINE_ATTRIBUTE.hidden, node.hidden],
      [OUTLINE_ATTRIBUTE.dev, node.dev],
      [OUTLINE_ATTRIBUTE.children, unlisted ? node.childCount : undefined],
    ];

    return attributes.flatMap(([name, value]): XmlAttribute[] => (value === undefined ? [] : [[name, String(value)]]));
  }

  #box(value: number | undefined): number | undefined {
    return value === undefined ? undefined : this.#numbers.round(value, PRECISION.box);
  }
}

export const OUTLINE_XML = new InjectionToken<OutlineXml>("OutlineXml");
