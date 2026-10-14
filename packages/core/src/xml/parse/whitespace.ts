/**
 * Text between tags without the indentation around it: every line is trimmed, lines are joined by one space, and
 * whitespace-only lines vanish; a run of spaces alone on one line (between two spans) stays as written. Spaces inside
 * one line stay; `&#32;` keeps an edge space, since entities are decoded after this. "" means the text is dropped.
 * (React's rule for JSX text.) Ported from Sitewright (MIT). Whitespace is XML's: spaces, tabs and line breaks; a
 * no-break or an em space is a character like any other.
 */
export function cleanMarkupText(raw: string): string {
  const lines = raw.replaceAll("\t", " ").split(/\r\n|\n|\r/);
  const lastContentLine = lines.findLastIndex((line) => /[^ ]/.test(line));
  let text = "";

  lines.forEach((line, index) => {
    let trimmed = line;

    if (index > 0) {
      trimmed = trimmed.replace(/^ +/, "");
    }

    if (index < lines.length - 1) {
      trimmed = trimmed.replace(/ +$/, "");
    }

    if (trimmed !== "") {
      // A space joins a line to the content after it: none after the last, nor on a line with no content after it.
      text += index < lastContentLine ? `${trimmed} ` : trimmed;
    }
  });

  return text;
}
