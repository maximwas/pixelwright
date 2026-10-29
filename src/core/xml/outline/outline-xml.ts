import { InjectionToken, inject, injectable } from "@needle-di/core";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";
import { OUTLINE_ATTRIBUTE } from "@/core/xml/outline/outline.constants.ts";
import { TAG, TAG_RULE } from "@/core/xml/tags.constants.ts";
import { XML } from "@/core/xml/xml.constants.ts";
import { XML_ESCAPE } from "@/core/xml/xml-escape.ts";
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
  readonly #escape;

  constructor(numbers = inject(NUMBER_FORMAT), xmlEscape = inject(XML_ESCAPE)) {
    this.#numbers = numbers;
    this.#escape = xmlEscape;
  }

  xml(root: OutlineNode): string {
    return this.#lines(root, 0).join(XML.lineBreak);
  }

  /** How many layers the outline lists. */
  count(root: OutlineNode): number {
    return (root.children ?? []).reduce((sum, child) => sum + this.count(child), 1);
  }

  #lines(node: OutlineNode, level: number): string[] {
    const indent = XML.indent.repeat(level);
    const tag = this.#tag(node.type);
    const attributes = this.#attributes(node);
    const children = node.children ?? [];

    if (children.length === 0) {
      return [XML.leaf(indent, tag, attributes)];
    }

    return [
      XML.open(indent, tag, attributes),
      ...children.flatMap((child) => this.#lines(child, level + 1)),
      XML.close(indent, tag),
    ];
  }

  #attributes(node: OutlineNode): string {
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

    return attributes
      .flatMap(([name, value]) =>
        value === undefined ? [] : [XML.attribute(name, this.#escape.attribute(String(value)))],
      )
      .join("");
  }

  #box(value: number | undefined): number | undefined {
    return value === undefined ? undefined : this.#numbers.round(value, PRECISION.box);
  }

  /** The vocabulary's tag for the type, or 0.7.0's rule for a type it lacks: the type in PascalCase. */
  #tag(type: string): string {
    if (Object.hasOwn(TAG, type)) {
      return TAG[type as keyof typeof TAG];
    }

    return type
      .toLowerCase()
      .split(TAG_RULE.wordSeparator)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }
}

export const OUTLINE_XML = new InjectionToken<OutlineXml>("OutlineXml");
