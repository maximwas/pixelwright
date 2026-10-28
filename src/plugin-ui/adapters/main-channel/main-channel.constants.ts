/** How Figma carries messages between the window and main (figma.ui): main's arrive as the window's message event. */
export const FIGMA_UI = {
  event: "message",
  /**
   * Who may receive what the window posts: any origin, because the window's parent is Figma itself and the window
   * cannot know the origin it runs under.
   */
  targetOrigin: "*",
} as const;
