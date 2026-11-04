export const SET_OF_TEXT = {
  noSet: (id: string, name: string) => `${id} "${name}" is not a component set, a variant or an instance of one.`,
} as const;
