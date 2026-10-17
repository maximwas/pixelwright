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
