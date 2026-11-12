/**
 * design_read's list `Name=Value, Other=Value` (a variant, a component's properties), a comma, equals sign or
 * backslash in it escaped with a backslash; null when an item names no property.
 */
export function nameValueList(value: string): Record<string, string> | null {
  const items = splitEscaped(value, ",");
  const pairs: [string, string][] = [];

  for (const [index, item] of items.entries()) {
    const at = unescapedIndex(item, "=");

    if (at !== -1) {
      pairs.push([unescaped(item.slice(0, at)).trim(), unescaped(item.slice(at + 1)).trim()]);
    } else if (index < items.length - 1 || unescaped(item).trim() !== "") {
      // Every item names a property; only a trailing comma may leave an empty one.
      return null;
    }
  }

  return Object.fromEntries(pairs);
}

/** The parts between unescaped separators, their escapes kept (an escaped separator is no separator). */
export function splitEscaped(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < value.length; index++) {
    if (value[index] === "\\") {
      index += 1;
    } else if (value[index] === separator) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));

  return parts;
}

/** Where a character first stands unescaped, or -1. */
function unescapedIndex(value: string, char: string): number {
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "\\") {
      index += 1;
    } else if (value[index] === char) {
      return index;
    }
  }

  return -1;
}

/** The text with its backslash escapes undone: a backslash keeps the character after it. */
export function unescaped(value: string): string {
  return value.replace(/\\([\s\S])/g, "$1");
}
