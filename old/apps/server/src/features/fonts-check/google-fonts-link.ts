/** The css2 link that loads a Google Fonts family in the weights used ("400", "600", "400 italic"). */
export function googleFontsLink(family: string, weights: readonly string[]): string {
  const parsed = weights
    .map((weight) => ({
      italic: weight.endsWith(" italic"),
      value: Number.parseInt(weight, 10),
    }))
    .toSorted((a, b) => Number(a.italic) - Number(b.italic) || a.value - b.value);
  const name = family.replaceAll(" ", "+");
  const axes = parsed.some((weight) => weight.italic)
    ? `ital,wght@${parsed.map((weight) => `${weight.italic ? 1 : 0},${weight.value}`).join(";")}`
    : `wght@${parsed.map((weight) => weight.value).join(";")}`;

  return `https://fonts.googleapis.com/css2?family=${name}:${axes}&display=swap`;
}
