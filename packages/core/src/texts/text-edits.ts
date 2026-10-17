/** One find-and-replace texts_replace makes: plain text or a regular expression, any case unless asked. */
export interface TextReplacement {
  readonly find: string;
  readonly replace: string;
  readonly regex?: boolean | undefined;
  readonly caseSensitive?: boolean | undefined;
  readonly wholeWord?: boolean | undefined;
}

/** A change to a text's characters: the range of the text as it was, and what goes there. */
export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** A letter, digit or underscore of any script: what a whole word does not touch on either side. */
const WORD = /[\p{L}\p{N}_]/u;

/**
 * The edits the replacements make to a text, all against the text as it was, so one pair never feeds another (a
 * dictionary's "Sign in" → "Log in" and "Log in" → "Enter" give "Log in"): where matches overlap, the earliest wins,
 * then the longest, then the first pair. Empty matches change nothing.
 */
export function textEdits(characters: string, replacements: readonly TextReplacement[]): TextEdit[] {
  const candidates = replacements.flatMap((replacement, order) =>
    matchesOf(characters, replacement).map((edit) => ({
      ...edit,
      order,
    })),
  );

  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order);

  const edits: TextEdit[] = [];
  let reached = 0;

  for (const { start, end, text } of candidates) {
    if (start >= reached) {
      edits.push({
        start,
        end,
        text,
      });
      reached = end;
    }
  }

  return edits;
}

/** The text with the edits made (each against the text as it was). */
export function applyTextEdits(characters: string, edits: readonly TextEdit[]): string {
  let result = "";
  let from = 0;

  for (const { start, end, text } of [...edits].sort((a, b) => a.start - b.start)) {
    result += characters.slice(from, start) + text;
    from = end;
  }

  return result + characters.slice(from);
}

function matchesOf(characters: string, replacement: TextReplacement): TextEdit[] {
  const pattern = patternOf(replacement);
  const edits: TextEdit[] = [];

  for (let match = pattern.exec(characters); match !== null; match = pattern.exec(characters)) {
    const start = match.index;
    const end = start + match[0].length;

    if (end === start) {
      pattern.lastIndex += 1;
    } else if (!replacement.wholeWord || bounded(characters, start, end)) {
      edits.push({
        start,
        end,
        text: replacement.regex
          ? expanded(characters, pattern, {
              start,
              end,
              template: replacement.replace,
            })
          : replacement.replace,
      });
    }
  }

  return edits;
}

/** The replacement's pattern, global, Unicode where the expression allows it; a bad expression says so. */
function patternOf({ find, regex, caseSensitive }: TextReplacement): RegExp {
  const flags = `g${caseSensitive ? "" : "i"}`;

  if (!regex) {
    return new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), `${flags}u`);
  }

  try {
    return new RegExp(find, `${flags}u`);
  } catch {
    try {
      return new RegExp(find, flags);
    } catch (error) {
      throw new Error(
        `/${find}/ is not a regular expression: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** Whether a match stands as a whole word: no letter or digit right before or after it. */
function bounded(characters: string, start: number, end: number): boolean {
  const before = characters.charAt(start - 1);
  const after = characters.charAt(end);

  return !(before !== "" && WORD.test(before)) && !(after !== "" && WORD.test(after));
}

/**
 * A regular expression's replacement for one match, its groups put in by String.replace itself ($&, $1, $<name>, $`,
 * $'): a sticky copy of the pattern replaces that match alone, where it stands in the whole text.
 */
function expanded(
  characters: string,
  pattern: RegExp,
  { start, end, template }: { start: number; end: number; template: string },
): string {
  const sticky = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}y`);

  sticky.lastIndex = start;

  const replaced = characters.replace(sticky, template);

  return replaced.slice(start, replaced.length - (characters.length - end));
}
