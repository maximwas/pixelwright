export const SHOW_TEXT = {
  giveNodes: "Give node or nodes: the layers to show.",
  notALayer: (id: string) => `${id} is not a layer on a page.`,
  twoPages: (
    id: string,
    on: string,
    page: string,
  ) =>
    `${id} is on page ${on}, the others on ${page}: show one page at a time.`,
} as const;
