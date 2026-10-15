import { textStyleCss } from "../../css-mapping/groups/text/styles.ts";
import { styleName } from "../../kernel/names.ts";
import type { Snapshot, SnapshotStyle, TextSegment } from "../../types/snapshot.ts";

/** The text styles and fonts a read refers to, gathered as its elements are built. */
export class ReadCatalogue {
  readonly #styles: Snapshot["styles"];
  readonly #textStyles = new Map<string, string>();
  readonly #fonts = new Map<string, Set<string>>();

  constructor(styles: Snapshot["styles"]) {
    this.#styles = styles;
  }

  /** Notes a text style the read names, with its CSS when the snapshot has the style; the name as given. */
  useTextStyle(name: string | undefined): string | undefined {
    if (name === undefined) {
      return undefined;
    }

    const style = Object.values(this.#styles).find(
      (candidate: SnapshotStyle) => candidate.type === "TEXT" && styleName(candidate) === name,
    );
    const css = style === undefined ? null : textStyleCss(style);

    if (css !== null) {
      this.#textStyles.set(name, css);
    }

    return name;
  }

  /** Notes the family and weight (italic said) a run of text uses. */
  useFont(segment: TextSegment): void {
    const italic = /italic/i.test(segment.fontName.style) ? " italic" : "";
    const weights = this.#fonts.get(segment.fontName.family) ?? new Set<string>();

    weights.add(`${segment.fontWeight}${italic}`);
    this.#fonts.set(segment.fontName.family, weights);
  }

  textStyles(): Record<string, string> {
    return Object.fromEntries([...this.#textStyles].sort(([a], [b]) => a.localeCompare(b)));
  }

  /** Each family with its weights, in natural order. */
  fonts(): Record<string, string[]> {
    return Object.fromEntries(
      [...this.#fonts].map(([family, weights]) => [
        family,
        [...weights].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
      ]),
    );
  }
}
