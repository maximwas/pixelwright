import type { OutlineNode } from "../types/operations.ts";
import { escapeAttribute } from "./escape.ts";
import { tagFor } from "./tags.ts";

const INDENT = "  ";

/**
 * The outline as XML, one tag per line: metadata and the box only. A node whose children are not all listed carries
 * `$children` with how many it has, so the model knows to outline it on its own.
 */
export function outlineXml(root: OutlineNode): string {
  const lines: string[] = [];

  writeNode(root, 0, lines);

  return lines.join("\n");
}

/** How many nodes an outline lists. */
export function countOutline(root: OutlineNode): number {
  return 1 + (root.children ?? []).reduce((sum, child) => sum + countOutline(child), 0);
}

function writeNode(node: OutlineNode, level: number, lines: string[]): void {
  const indent = INDENT.repeat(level);
  const tag = tagFor(node.type);
  const children = node.children ?? [];
  const values: [string, string | number | boolean | undefined][] = [
    ["id", node.id],
    ["name", node.name],
    ["x", node.x],
    ["y", node.y],
    ["width", node.width],
    ["height", node.height],
    ["hidden", node.hidden],
    ["$children", node.childCount !== undefined && children.length < node.childCount ? node.childCount : undefined],
  ];
  const attributes = values
    .filter((pair): pair is [string, string | number | boolean] => pair[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeAttribute(String(value))}"`)
    .join("");

  if (children.length === 0) {
    lines.push(`${indent}<${tag}${attributes}/>`);

    return;
  }

  lines.push(`${indent}<${tag}${attributes}>`);

  for (const child of children) {
    writeNode(child, level + 1, lines);
  }

  lines.push(`${indent}</${tag}>`);
}
