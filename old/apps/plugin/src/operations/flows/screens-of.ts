import { SCREEN_TYPES } from "./constants.ts";

/** The page's screens: its frames, and those in its sections. */
export function screensOf(page: PageNode): SceneNode[] {
  return page.children
    .flatMap((node) => (node.type === "SECTION" ? node.children : [node]))
    .filter((node) => SCREEN_TYPES.has(node.type));
}
