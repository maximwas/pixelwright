/** nodes_diff as clients list it (tools.json pins every word): 0.7.0's words. */
export const NODES_DIFF_TOOL = {
  name: "nodes_diff",
  title: "Compare two layers",
  description:
    "Compares two layers (A/B variants of a screen, a card and its copy) as design_read reads them: layers are matched by their path of names below each root (same-named siblings in order), and the answer lists the layers only A or only B has, and for each layer both have, the attributes that differ as [A's, B's] (text as $text, an instance's variant and props too) and whether an icon's or image's own drawing differs (paths, colours, inner layers). Ids and the two roots' own names and places are left out. Works while Allow edits is off. To compare a layer with how it was when you built it, use baseline_diff.",
} as const;

export const NODES_DIFF_FIELD = {
  a: "The first layer's id (variant A), e.g. 54:243.",
  b: "The second layer's id (variant B).",
  depth: "Levels below each layer to compare. Default: all.",
  more: "Differences past the ones listed: compare smaller parts of the two layers.",
} as const;

export const NODES_DIFF_TEXT = {
  named: (id: string, name: string) => `${id} "${name}"`,
  same: (first: string, second: string) => `${first} and ${second} read the same.`,
  differs: (
    first: string,
    second: string,
    counts: { readonly changed: number; readonly onlyInA: number; readonly onlyInB: number },
  ) =>
    `${first} and ${second}: ${counts.changed} ${counts.changed === 1 ? "layer differs" : "layers differ"}, ${counts.onlyInA} only in A, ${counts.onlyInB} only in B.`,
} as const;
