import { InjectionToken, inject, injectable } from "@needle-di/core";
import { intersection, sortBy, union, uniq } from "es-toolkit";
import { BREAKPOINTS, BREAKPOINTS_TEXT, SIZE_WORDS, WORD_BREAK } from "@/core/diff/diff.constants.ts";
import type { BreakpointsView } from "@/core/diff/diff.schema.ts";
import { NUMBER_FORMAT } from "@/core/kernel/numbers/number-format.ts";
import type { PageScreen, ScreensRaw } from "@/shared/ops/screens/screens.schema.ts";

/**
 * The screen asked about at other widths (T-087, K-054): the page's screens whose names match once size words are
 * left out and whose children share names with it, scored by BREAKPOINTS' weights, narrowest first.
 */
@injectable()
export class Breakpoints {
  readonly #format;

  constructor(format = inject(NUMBER_FORMAT)) {
    this.#format = format;
  }

  of({ target, screens }: ScreensRaw): BreakpointsView {
    const words = this.#words(target.name);
    const matches = screens
      // Another width, not another state of the screen at its own width (a menu open).
      .filter((screen) => Math.abs(screen.width - target.width) > BREAKPOINTS.sameWidth)
      .map((screen) => ({ screen, score: this.#score(words, target, screen) }))
      .filter(({ score }) => score >= BREAKPOINTS.sameScreen);
    const widths = sortBy(
      [
        { ...this.#size(target), score: 1, this: true as const },
        ...matches.map(({ screen, score }) => ({ ...this.#size(screen), score })),
      ],
      [({ width }) => width],
    );

    return {
      summary:
        matches.length === 0
          ? BREAKPOINTS_TEXT.none(target.name)
          : BREAKPOINTS_TEXT.found(
            target.name,
            widths.map(({ width }) => width),
          ),
      widths,
    };
  }

  /** Screens named only by their size ("Desktop", "375") are told apart by their children alone. */
  #score(
    words: readonly string[],
    target: PageScreen,
    screen: PageScreen,
  ): number {
    const named = this.#words(screen.name);
    const shared = this.#overlap(target.children, screen.children);
    const score =
      words.length === 0 && named.length === 0
        ? shared
        : BREAKPOINTS.names * this.#overlap(words, named) + BREAKPOINTS.children * shared;

    return this.#format.round(score, BREAKPOINTS.scorePlaces);
  }

  #words(name: string): string[] {
    return uniq(
      name
        .replace(SIZE_WORDS, BREAKPOINTS.space)
        .toLowerCase()
        .split(WORD_BREAK)
        .filter((word) => word !== ""),
    );
  }

  /** Jaccard overlap of two lists taken as sets, 0 when both are empty. */
  #overlap(first: readonly string[], second: readonly string[]): number {
    const all = union(first, second);

    return all.length === 0 ? 0 : intersection(uniq(first), second).length / all.length;
  }

  #size({ id, name, width, height }: PageScreen): Omit<PageScreen, "children"> {
    return { id, name, width, height };
  }
}

export const BREAKPOINTS_FINDER = new InjectionToken<Breakpoints>("Breakpoints");
