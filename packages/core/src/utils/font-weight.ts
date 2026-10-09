/** A weight from a style name, for text styles (which carry no weight of their own) and for finding a font's style by weight. */
export function weightOf(style: string): number {
  const names: [RegExp, number][] = [
    [/thin|hairline/i, 100],
    [/extra ?light|ultra ?light/i, 200],
    [/semi ?bold|demi ?bold/i, 600],
    [/extra ?bold|ultra ?bold/i, 800],
    [/black|heavy/i, 900],
    [/light/i, 300],
    [/medium/i, 500],
    [/bold/i, 700],
  ];

  return names.find(([pattern]) => pattern.test(style))?.[1] ?? 400;
}
