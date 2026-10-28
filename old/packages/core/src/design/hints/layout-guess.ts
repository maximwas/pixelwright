import { boxShorthand, px } from "../../css-mapping/values/format.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";

/** What Figma guesses for a frame placed by hand (inferredAutoLayout). */
type LayoutGuess = NonNullable<SnapshotNode["inferredLayout"]>;

const JUSTIFY: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
};

const ALIGN: Readonly<Record<string, string>> = {
  CENTER: "center",
  MAX: "flex-end",
  BASELINE: "baseline",
};

/** Figma's guess at the flow a frame placed by hand would have, as the CSS a build could give it. */
export function guessedLayoutCss(guess: LayoutGuess, children: number): string {
  const sides = [guess.paddingTop, guess.paddingRight, guess.paddingBottom, guess.paddingLeft].map((side) =>
    px(side ?? 0),
  );
  const justified = JUSTIFY[guess.primaryAxisAlignItems ?? "MIN"];
  const aligned = ALIGN[guess.counterAxisAlignItems ?? "MIN"];
  const spaced = children >= 2 && (guess.itemSpacing ?? 0) > 0 && guess.primaryAxisAlignItems !== "SPACE_BETWEEN";
  const parts = [
    "display: flex",
    guess.layoutMode === "VERTICAL" ? "flex-direction: column" : null,
    sides.some((side) => side !== "0")
      ? `padding: ${boxShorthand(...(sides as [string, string, string, string]))}`
      : null,
    justified === undefined ? null : `justify-content: ${justified}`,
    aligned === undefined ? null : `align-items: ${aligned}`,
    spaced ? `gap: ${px(guess.itemSpacing ?? 0)}` : null,
  ];

  return parts.filter((part) => part !== null).join("; ");
}
