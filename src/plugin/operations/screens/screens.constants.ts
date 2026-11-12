export const SCREENS_TEXT = {
  offPage: (id: string) => `${id} is not a layer on a page.`,
  noScreen: (id: string, name: string) =>
    `${id} "${name}" is on no screen: give a frame on the page or a layer in one.`,
} as const;
