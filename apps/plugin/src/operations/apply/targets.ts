import { type ApplyChange, BridgeError } from "@pixelwright/core";
import { loadPageOf } from "../../figma/nodes.ts";
import { WriteError } from "../../figma/write-error.ts";

/** The tags of the text layers' types, as design_read writes them: the types a tag mismatch is about. */
const TEXT_TAG_OF: Readonly<Partial<Record<NodeType, string>>> = {
  TEXT: "Text",
  TEXT_PATH: "TextPath",
};

/** Where top-level new layers go: a frame's or a page's id, its page loaded. */
export async function topLayer(id: string): Promise<PageNode | SceneNode> {
  const node = await figma.getNodeByIdAsync(id);

  if (node === null || node.type === "DOCUMENT") {
    throw new BridgeError("NODE_NOT_FOUND", `No layer ${id} in this file to put the new layers in.`);
  }

  await loadPageOf(node);

  return node;
}

/** The layer an element changes, its tag matching its type; its page loaded unless a dry run only checks it. */
export async function existingLayer(change: ApplyChange, { load }: { readonly load: boolean }): Promise<SceneNode> {
  const node = change.id === null ? null : await figma.getNodeByIdAsync(change.id);

  if (node === null || node.type === "PAGE" || node.type === "DOCUMENT") {
    throw new WriteError(`No layer ${change.id} in this file.`, "Read the ids again with design_read or nodes_find.");
  }

  if (
    (change.tag === "Text") !== (node.type === "TEXT") ||
    (change.tag === "TextPath") !== (node.type === "TEXT_PATH")
  ) {
    throw new WriteError(
      `${change.id} is ${withArticle(TEXT_TAG_OF[node.type] ?? node.type.toLowerCase())}, not ${withArticle(change.tag)}.`,
      "Check the id: the tag is the layer's type as design_read writes it.",
    );
  }

  if (load) {
    await loadPageOf(node);
  }

  return node;
}

function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}
