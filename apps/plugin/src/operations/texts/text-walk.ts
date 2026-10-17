import { BridgeError } from "@pixelwright/core";
import { loadPageOf, requireNode } from "../../figma/nodes.ts";

/** The roots by id, their pages loaded: layers, or pages for every text on them. */
export async function textRoots(ids: readonly string[]): Promise<BaseNode[]> {
  const roots: BaseNode[] = [];

  for (const id of ids) {
    const node = await requireNode(id);

    if (node.type === "DOCUMENT") {
      throw new BridgeError("NODE_NOT_FOUND", `${id} is the document: give its pages or layers.`);
    }

    await loadPageOf(node);
    roots.push(node);
  }

  return roots;
}

/** Every text under the roots (a root that is a text among them), each once, in document order. */
export function textsUnder(roots: readonly BaseNode[]): TextNode[] {
  const seen = new Set<string>();
  const texts: TextNode[] = [];

  for (const root of roots) {
    const found =
      root.type === "TEXT"
        ? [root]
        : "findAll" in root
          ? (root.findAll((node) => node.type === "TEXT") as TextNode[])
          : [];

    for (const text of found) {
      if (!seen.has(text.id)) {
        seen.add(text.id);
        texts.push(text);
      }
    }
  }

  return texts;
}
