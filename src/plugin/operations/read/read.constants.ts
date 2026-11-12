/** What the read op says of a node it does not read. */
export const READ_TEXT = {
  notLayer: (id: string, type: string) => `${id} is a ${type.toLowerCase()}: read a layer on a page.`,
} as const;
