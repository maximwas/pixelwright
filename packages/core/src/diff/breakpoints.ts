import type { Breakpoints, ScreensRaw } from "../types/breakpoints.ts";

/** Words and numbers that name a size, not a screen: Desktop, Mobile, 1440, 375px, 1440×900. */
const SIZE_WORDS =
  /\b(desktop|tablet|mobile|phone|laptop|web|ipad|iphone|android|wide|small|medium|large|xl|lg|md|sm|xs|\d{3,4}(\s*[x×]\s*\d{3,4})?(px)?)\b/gi;
/** The least a screen must score to count as the same one at another width. */
const SAME_SCREEN = 0.5;

/**
 * The screen asked about at other widths: the page's screens whose names match once size words are left out, and
 * whose children share names with it, narrowest first.
 */
export function breakpointsOf({ target, screens }: ScreensRaw): Breakpoints {
  const words = wordsOf(target.name);
  const children = new Set(target.children);
  const matches = screens
    .map((screen) => ({
      screen,
      score:
        Math.round(
          (0.6 * overlap(words, wordsOf(screen.name)) + 0.4 * overlap(children, new Set(screen.children))) * 100,
        ) / 100,
    }))
    .filter(({ score }) => score >= SAME_SCREEN);
  const widths = [
    {
      id: target.id,
      name: target.name,
      width: target.width,
      height: target.height,
      score: 1,
      this: true as const,
    },
    ...matches.map(({ screen, score }) => ({
      id: screen.id,
      name: screen.name,
      width: screen.width,
      height: screen.height,
      score,
    })),
  ].toSorted((a, b) => a.width - b.width);

  return {
    summary:
      matches.length === 0
        ? `No other screen on the page looks like ${target.name} at another width.`
        : `${target.name} at ${widths.map((screen) => `${screen.width}px`).join(", ")}: compare them with nodes_diff for the media queries.`,
    widths,
  };
}

function wordsOf(name: string): Set<string> {
  return new Set(
    name
      .replace(SIZE_WORDS, " ")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word !== ""),
  );
}

/** Jaccard overlap of two sets, 0 when both are empty. */
function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  const union = new Set([...a, ...b]);

  return union.size === 0 ? 0 : [...a].filter((item) => b.has(item)).length / union.size;
}
